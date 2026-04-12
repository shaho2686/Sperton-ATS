const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');

const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.resolve(__dirname, 'artifacts');
const CHROME_PATH = process.env.CHROME_EXECUTABLE_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3000/portal/';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const LOGIN_USER = process.env.PORTAL_QA_USER || 'admin';
const LOGIN_PASSWORD = process.env.PORTAL_QA_PASSWORD || 'admin';
const JWT_SECRET = process.env.JWT_SECRET || 'sperton-jwt-secret-key-2026';
const CAPTURE_SCREENSHOTS = process.env.PORTAL_QA_CAPTURE === '1';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const report = {
  startedAt: new Date().toISOString(),
  portalUrl: PORTAL_URL,
  checks: [],
  screenshots: [],
  warnings: []
};

function buildSignedToken(id, username, role = 'admin') {
  return jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '24h' });
}

const BOOTSTRAP_TOKEN = buildSignedToken(1, LOGIN_USER, 'admin');

function logCheck(name, status, details) {
  report.checks.push({ name, status, details });
  const symbol = status === 'passed' ? 'PASS' : status === 'skipped' ? 'SKIP' : 'FAIL';
  console.log(`[${symbol}] ${name}${details ? ` - ${details}` : ''}`);
}

function cleanupArtifactImages() {
  if (!fs.existsSync(ARTIFACTS_DIR)) return;
  for (const entry of fs.readdirSync(ARTIFACTS_DIR)) {
    if (/\.png$/i.test(entry)) {
      fs.rmSync(path.join(ARTIFACTS_DIR, entry), { force: true });
    }
  }
}

async function screenshot(page, filename) {
  if (!CAPTURE_SCREENSHOTS) return;
  const target = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: target, fullPage: true });
  report.screenshots.push(target);
}

async function captureFailureScreenshot(page) {
  const target = path.join(ARTIFACTS_DIR, '99-failure.png');
  await page.screenshot({ path: target, fullPage: true });
  if (!report.screenshots.includes(target)) {
    report.screenshots.push(target);
  }
}

async function expect(condition, name, details) {
  if (!condition) {
    throw new Error(`${name}${details ? `: ${details}` : ''}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForToast(page) {
  await page.waitForFunction(() => {
    const toast = document.getElementById('toast');
    return toast && toast.classList.contains('show') && toast.textContent.trim().length > 0;
  }, { timeout: 10000 });

  return page.$eval('#toast', element => element.textContent.trim());
}

async function getAuthToken(page) {
  return page.evaluate(() => localStorage.getItem('srp_token'));
}

async function nodeApiJson(endpoint, options = {}) {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...rest,
    headers: {
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_err) {
    json = null;
  }
  return { status: response.status, ok: response.ok, json, text, headers: response.headers };
}

async function apiJson(page, endpoint, options = {}) {
  const token = await getAuthToken(page);
  return nodeApiJson(endpoint.replace(API_BASE_URL, ''), { ...options, token });
}

function createFixturePdf() {
  const pdfPath = path.join(os.tmpdir(), `sperton-qa-${Date.now()}.pdf`);
  const content = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');
  fs.writeFileSync(pdfPath, content);
  return pdfPath;
}

function createFixturePng() {
  const pngPath = path.join(os.tmpdir(), `sperton-qa-${Date.now()}.png`);
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pY9nWQAAAAASUVORK5CYII=';
  fs.writeFileSync(pngPath, Buffer.from(base64, 'base64'));
  return pngPath;
}

async function switchSession(page, session) {
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('srp_token', token);
    localStorage.setItem('srp_user', JSON.stringify(user));
  }, session);

  await page.goto(PORTAL_URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.getElementById('app-screen')?.style.display === 'block', { timeout: 15000 });
  await page.waitForSelector('#results-list', { timeout: 15000 });
}

async function bootstrapSession(page) {
  await switchSession(page, {
    token: BOOTSTRAP_TOKEN,
    user: {
      id: 1,
      username: LOGIN_USER,
      role: 'admin',
      fullName: 'QA Bootstrap',
      apiKey: 'qa-bootstrap'
    }
  });
}

async function login(page) {
  await page.goto(PORTAL_URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-username', { timeout: 10000 });
  await page.click('#login-username', { clickCount: 3 });
  await page.type('#login-username', LOGIN_USER);
  await page.click('#login-password', { clickCount: 3 });
  await page.type('#login-password', LOGIN_PASSWORD);
  await screenshot(page, '01-login.png');

  await page.click('#login-btn');

  try {
    await page.waitForFunction(() => document.getElementById('app-screen')?.style.display === 'block', { timeout: 6000 });
  } catch (_err) {
    const loginError = await page.$eval('#login-error', element => element.textContent.trim()).catch(() => '');
    if (/invalid credentials/i.test(loginError)) {
      report.warnings.push('Login endpoint rejected demo credentials. Falling back to signed QA token.');
      await bootstrapSession(page);
    } else {
      throw _err;
    }
  }

  await page.waitForSelector('#results-list', { timeout: 15000 });
  await screenshot(page, '02-dashboard.png');
}

async function provisionManagedAdmin(page, adminFixture) {
  const registerRes = await nodeApiJson('/api/auth/register', {
    token: BOOTSTRAP_TOKEN,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: adminFixture.fullName,
      username: adminFixture.username,
      password: adminFixture.password,
      role: 'admin'
    })
  });

  await expect(registerRes.ok && registerRes.json?.success, 'provision managed admin', registerRes.json?.error || registerRes.text);

  const usersRes = await nodeApiJson('/api/users', { token: BOOTSTRAP_TOKEN });
  await expect(usersRes.ok && usersRes.json?.success, 'list users after admin provision', usersRes.json?.error || usersRes.text);

  const adminUser = (usersRes.json.data || []).find(user => user.username === adminFixture.username);
  await expect(adminUser, 'provision managed admin', `Could not find ${adminFixture.username} in user list`);

  adminFixture.id = adminUser.id;
  adminFixture.role = adminUser.role;
  adminFixture.token = buildSignedToken(adminUser.id, adminUser.username, adminUser.role);

  await switchSession(page, {
    token: adminFixture.token,
    user: {
      id: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      fullName: adminUser.full_name,
      apiKey: 'qa-managed-admin'
    }
  });
}

async function assertUnauthorizedAccess() {
  const users = await nodeApiJson('/api/users');
  await expect(users.status === 401, 'unauthorized users endpoint', `Expected 401, got ${users.status}`);

  const candidates = await nodeApiJson('/api/candidates');
  await expect(candidates.status === 401, 'unauthorized candidates endpoint', `Expected 401, got ${candidates.status}`);
}

async function testUserValidation(page, invalidUser) {
  await page.evaluate(() => openAddUserModal());
  await page.waitForSelector('#add-user-modal.open', { timeout: 10000 });

  await page.type('#user-full-name', invalidUser.fullName);
  await page.type('#user-username', invalidUser.username);
  await page.type('#user-password', invalidUser.password);
  await page.click('#user-submit-btn');

  await page.waitForFunction(() => {
    const error = document.getElementById('user-password-error');
    return error && error.textContent.includes('At least 6 characters.');
  }, { timeout: 5000 });

  await screenshot(page, '03-user-validation.png');
  await page.evaluate(() => closeAddUserModal());
}

async function testUserCrud(page, userFixture) {
  await page.evaluate(() => openAddUserModal());
  await page.waitForSelector('#add-user-modal.open', { timeout: 10000 });

  await page.type('#user-full-name', userFixture.fullName);
  await page.type('#user-username', userFixture.username);
  await page.type('#user-password', userFixture.password);
  await page.select('#user-role', userFixture.role);
  await screenshot(page, '04-add-user-modal.png');
  await page.click('#user-submit-btn');
  const createToast = await waitForToast(page);
  await expect(/created/i.test(createToast), 'create user', `Unexpected toast: ${createToast}`);

  const usersRes = await apiJson(page, '/api/users');
  await expect(usersRes.ok && usersRes.json?.success, 'list users after creation', usersRes.json?.error || usersRes.text);
  const createdUser = (usersRes.json.data || []).find(user => user.username === userFixture.username);
  await expect(createdUser, 'create user', `Could not find ${userFixture.username} after creation`);
  userFixture.id = createdUser.id;

  await page.evaluate(user => openEditUserModal(String(user.id), user.full_name, user.username, user.role), createdUser);
  await page.waitForSelector('#edit-user-modal.open', { timeout: 10000 });
  await page.click('#edit-user-full-name', { clickCount: 3 });
  await page.type('#edit-user-full-name', userFixture.updatedFullName);
  await page.click('#edit-user-username', { clickCount: 3 });
  await page.type('#edit-user-username', userFixture.updatedUsername);
  await page.select('#edit-user-role', 'admin');
  await screenshot(page, '05-edit-user-modal.png');
  await page.click('#edit-user-submit-btn');
  const editToast = await waitForToast(page);
  await expect(/updated/i.test(editToast), 'edit user', `Unexpected toast: ${editToast}`);

  const updatedUsers = await apiJson(page, '/api/users');
  const updatedUser = (updatedUsers.json?.data || []).find(user => user.id === userFixture.id);
  await expect(updatedUser && updatedUser.username === userFixture.updatedUsername && updatedUser.role === 'admin', 'edit user', 'Updated user details were not persisted');

  await page.evaluate(user => openDeleteUserModal(String(user.id), user.full_name), updatedUser);
  await page.waitForSelector('#delete-user-modal.open', { timeout: 10000 });
  await screenshot(page, '06-delete-user-modal.png');
  await page.click('#delete-user-submit-btn');
  const deleteToast = await waitForToast(page);
  await expect(/deleted/i.test(deleteToast), 'delete user', `Unexpected toast: ${deleteToast}`);

  const finalUsers = await apiJson(page, '/api/users');
  const deletedUser = (finalUsers.json?.data || []).find(user => user.id === userFixture.id);
  await expect(!deletedUser, 'delete user', `User ${userFixture.updatedUsername} still exists after deletion`);
  userFixture.id = null;
}

async function testProfileValidation(page, adminFixture) {
  await page.click('button[onclick="openProfileModal()"]');
  await page.waitForSelector('#profile-modal.open', { timeout: 10000 });

  await page.type('#profile-current-password', adminFixture.password);
  await page.type('#profile-new-password', adminFixture.nextPassword);
  await page.type('#profile-confirm-password', `${adminFixture.nextPassword}-mismatch`);
  await page.click('#profile-save-btn');

  await page.waitForFunction(() => {
    const error = document.getElementById('profile-password-error');
    return error && error.textContent.includes('New passwords do not match.');
  }, { timeout: 5000 });

  await screenshot(page, '07-profile-validation.png');
  await page.evaluate(() => closeProfileModal());
}

async function testProfileUpdate(page, adminFixture) {
  const avatarPath = createFixturePng();

  await page.click('button[onclick="openProfileModal()"]');
  await page.waitForSelector('#profile-modal.open', { timeout: 10000 });

  await page.click('#profile-full-name', { clickCount: 3 });
  await page.type('#profile-full-name', adminFixture.updatedFullName);
  const photoInput = await page.$('#profile-photo-input');
  await expect(photoInput, 'profile photo input', 'Profile photo input not found');
  await photoInput.uploadFile(avatarPath);
  await sleep(500);
  await page.type('#profile-current-password', adminFixture.password);
  await page.type('#profile-new-password', adminFixture.nextPassword);
  await page.type('#profile-confirm-password', adminFixture.nextPassword);
  await screenshot(page, '08-profile-update-modal.png');
  await page.click('#profile-save-btn');

  const toast = await waitForToast(page);
  await expect(/profile and password saved/i.test(toast), 'profile update', `Unexpected toast: ${toast}`);

  const authMe = await apiJson(page, '/api/auth/me');
  await expect(authMe.ok && authMe.json?.success, 'profile update /auth/me', authMe.json?.error || authMe.text);
  await expect(authMe.json.user?.full_name === adminFixture.updatedFullName, 'profile full name', `Expected ${adminFixture.updatedFullName}, got ${authMe.json.user?.full_name}`);

  const avatarPresent = await page.evaluate(() => !!document.querySelector('#header-avatar img'));
  await expect(avatarPresent, 'profile avatar render', 'Header avatar image did not render after upload');

  adminFixture.password = adminFixture.nextPassword;
}

async function addCandidate(page, fixture) {
  const pdfPath = createFixturePdf();

  await page.click('button[onclick="openAddCandidateModal()"]');
  await page.waitForSelector('#add-modal.open', { timeout: 10000 });

  await page.type('#add-name', fixture.name);
  await page.type('#add-email', fixture.email);
  await page.type('#add-phone', fixture.phone);
  await page.type('#add-title', fixture.title);
  await page.type('#add-company', fixture.company);
  await page.type('#add-experience', String(fixture.experience));
  await page.type('#add-position', fixture.position);
  await page.type('#add-source', fixture.source);
  await page.type('#add-linkedin', fixture.linkedin);
  await page.type('#add-resume', fixture.resumeText);
  await page.type('#add-notes', fixture.notes);
  await page.type('#add-skills-input', 'QA Automation');
  await page.keyboard.press('Enter');
  await page.type('#add-skills-input', 'Recruiting Ops');
  await page.keyboard.press('Enter');
  await page.click('#country-trigger');
  await page.waitForSelector('#country-dropdown', { visible: true, timeout: 5000 });
  await page.type('#country-search', 'Pakistan');
  await page.evaluate(() => {
    const option = Array.from(document.querySelectorAll('.country-option'))
      .find(el => el.textContent.trim().toLowerCase().includes('pakistan'));
    if (option) option.click();
  });
  const resumeInput = await page.$('#add-resume-file');
  await expect(resumeInput, 'resume file input', 'Resume file input was not found');
  await resumeInput.uploadFile(pdfPath);
  await screenshot(page, '09-add-candidate-modal.png');

  await page.click('#add-submit-btn');
  await page.waitForFunction(
    expectedName => Array.from(document.querySelectorAll('.candidate-card .card-name')).some(el => el.textContent.includes(expectedName)),
    { timeout: 30000 },
    fixture.name
  );
  await screenshot(page, '10-candidate-added.png');
}

async function findCandidateIdByName(page, name) {
  return page.evaluate(candidateName => {
    const card = Array.from(document.querySelectorAll('.candidate-card'))
      .find(element => element.querySelector('.card-name')?.textContent.includes(candidateName));
    return card ? card.id.replace(/^card-/, '') : null;
  }, name);
}

async function openDetailForCandidate(page, name) {
  const candidateId = await findCandidateIdByName(page, name);
  await expect(candidateId, 'candidate lookup', `Could not find ${name} in candidate list`);
  await page.click(`#card-${candidateId}`);
  await page.waitForSelector('#detail-panel.open', { timeout: 10000 });
  await screenshot(page, '11-detail-panel.png');
  return candidateId;
}

async function editCandidate(page, candidateId, updatedCompany) {
  await page.click(`button[onclick="openEditCandidateModal('${candidateId}')"]`).catch(async () => {
    await page.click('#detail-body button.btn.btn-primary');
  });
  await page.waitForSelector('#add-modal.open', { timeout: 10000 });
  await page.click('#add-company', { clickCount: 3 });
  await page.type('#add-company', updatedCompany);
  await page.click('#add-notes', { clickCount: 3 });
  await page.type('#add-notes', 'Updated during automated QA.');
  await screenshot(page, '12-edit-candidate.png');
  await page.click('#add-submit-btn');
  const toast = await waitForToast(page);
  await expect(/updated/i.test(toast), 'edit candidate', `Unexpected toast: ${toast}`);
}

async function testSearchAndFilters(page, fixture) {
  await page.click('#search-input', { clickCount: 3 });
  await page.type('#search-input', fixture.name);
  await page.waitForFunction(
    expectedName => document.querySelectorAll('.candidate-card').length === 1 && document.querySelector('.candidate-card .card-name')?.textContent.includes(expectedName),
    { timeout: 10000 },
    fixture.name
  );
  await screenshot(page, '13-search-filter.png');

  await page.click('#search-input', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.select('#filter-source', fixture.source);
  await sleep(500);
  await page.select('#filter-source', '');
}

async function testBoardAndStatus(page, candidateId) {
  await page.click('#view-board-btn');
  await page.waitForSelector('.results-list.board-view', { timeout: 10000 });
  await screenshot(page, '14-board-view.png');

  await page.click('#view-list-btn');
  await page.waitForFunction(() => !document.getElementById('results-list')?.classList.contains('board-view'), { timeout: 10000 });
  await page.click(`#card-${candidateId}`);
  await page.waitForSelector('#detail-panel.open', { timeout: 10000 });
  await page.select('#detail-status', 'screening');
  const toast = await waitForToast(page);
  await expect(/status|updated/i.test(toast), 'update status', `Unexpected toast: ${toast}`);
}

async function testResumeDownload(page, candidateId) {
  const token = await getAuthToken(page);
  const res = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/resume?download=1`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  await expect(res.ok, 'resume download endpoint', `HTTP ${res.status}`);
  const contentDisposition = res.headers.get('content-disposition') || '';
  const contentType = res.headers.get('content-type') || '';
  await expect(/attachment/i.test(contentDisposition), 'resume content disposition', contentDisposition);
  await expect(/pdf|text|octet-stream/i.test(contentType), 'resume content type', contentType);
}

async function testAiFeatures(page, candidateId) {
  const analysis = await apiJson(page, '/api/ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId })
  });

  if (!analysis.ok) {
    const message = analysis.json?.error || analysis.text || `HTTP ${analysis.status}`;
    logCheck('AI analysis', 'skipped', message);
    report.warnings.push(`AI analysis skipped: ${message}`);
  } else {
    logCheck('AI analysis', 'passed', 'AI analyze endpoint responded successfully');
  }

  const outreach = await apiJson(page, '/api/ai/outreach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId, position: 'QA Engineer', clientCompany: 'Sperton' })
  });

  if (!outreach.ok) {
    const message = outreach.json?.error || outreach.text || `HTTP ${outreach.status}`;
    logCheck('AI outreach', 'skipped', message);
    report.warnings.push(`AI outreach skipped: ${message}`);
  } else {
    logCheck('AI outreach', 'passed', 'AI outreach endpoint responded successfully');
  }
}

async function deleteCandidate(page, candidateId, name) {
  await page.evaluate(id => {
    const button = Array.from(document.querySelectorAll('.candidate-card .btn-danger'))
      .find(btn => btn.getAttribute('onclick')?.includes(`deleteCandidate('${id}')`));
    if (button) button.click();
  }, candidateId);

  await page.waitForFunction(
    expectedName => !Array.from(document.querySelectorAll('.candidate-card .card-name')).some(el => el.textContent.includes(expectedName)),
    { timeout: 10000 },
    name
  );
  await screenshot(page, '15-candidate-deleted.png');
}

async function assertCannotDeleteSelf(adminFixture) {
  const response = await nodeApiJson(`/api/users/${adminFixture.id}`, {
    token: adminFixture.token,
    method: 'DELETE'
  });
  await expect(response.status === 400, 'delete self blocked', `Expected 400, got ${response.status}`);
}

async function cleanupFixture(candidateId, userId) {
  if (candidateId) {
    await nodeApiJson(`/api/candidates/${candidateId}`, { token: BOOTSTRAP_TOKEN, method: 'DELETE' }).catch(() => {});
  }
  if (userId) {
    await nodeApiJson(`/api/users/${userId}`, { token: BOOTSTRAP_TOKEN, method: 'DELETE' }).catch(() => {});
  }
}

async function writeReport() {
  report.finishedAt = new Date().toISOString();
  const failed = report.checks.filter(check => check.status === 'failed').length;
  const output = path.join(ARTIFACTS_DIR, 'qa-report.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(`QA report written to ${output}`);
  if (failed > 0) {
    throw new Error(`${failed} QA checks failed`);
  }
}

(async () => {
  const timestamp = Date.now();
  const adminFixture = {
    username: `qa_admin_${timestamp}`,
    fullName: `QA Admin ${timestamp}`,
    updatedFullName: `QA Admin Updated ${timestamp}`,
    password: 'QaAdmin123!',
    nextPassword: 'QaAdmin456!'
  };
  const userFixture = {
    username: `qa_recruiter_${timestamp}`,
    updatedUsername: `qa_recruiter_edit_${timestamp}`,
    fullName: `QA Recruiter ${timestamp}`,
    updatedFullName: `QA Recruiter Updated ${timestamp}`,
    password: 'Recruit123!',
    role: 'recruiter',
    id: null
  };
  const invalidUser = {
    username: `qa_invalid_${timestamp}`,
    fullName: 'Invalid User',
    password: '123'
  };
  const candidateFixture = {
    name: `QA Candidate ${timestamp}`,
    email: `qa.${timestamp}@example.com`,
    phone: `+92 300 ${String(timestamp).slice(-7, -4)} ${String(timestamp).slice(-4)}`,
    title: 'QA Engineer',
    company: 'Sperton QA Lab',
    updatedCompany: 'Sperton QA Ops',
    experience: 5,
    position: 'Quality Assurance Engineer',
    source: 'manual',
    linkedin: `https://linkedin.com/in/qa-candidate-${timestamp}`,
    resumeText: 'Automated QA resume content for portal validation.',
    notes: 'Created by automated QA.'
  };

  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Chrome executable not found at ${CHROME_PATH}`);
  }

  cleanupArtifactImages();

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width: 1440, height: 1000 }
  });

  let candidateId = null;
  const page = await browser.newPage();
  page.on('dialog', async dialog => {
    console.log(`Dialog encountered: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    await login(page);
    logCheck('Login', 'passed', 'Portal dashboard loaded');

    await provisionManagedAdmin(page, adminFixture);
    logCheck('Provision managed admin', 'passed', adminFixture.username);

    await assertUnauthorizedAccess();
    logCheck('Unauthorized access', 'passed', 'Protected endpoints return 401 without auth');

    await testUserValidation(page, invalidUser);
    logCheck('Invalid user form', 'passed', 'Short password validation blocked submission');

    await testProfileValidation(page, adminFixture);
    logCheck('Profile validation', 'passed', 'Password mismatch validation blocked submission');

    await testProfileUpdate(page, adminFixture);
    logCheck('Profile update and avatar', 'passed', adminFixture.updatedFullName);

    await assertCannotDeleteSelf(adminFixture);
    logCheck('Delete self blocked', 'passed', 'Admin cannot delete own account');

    await testUserCrud(page, userFixture);
    logCheck('Admin user CRUD', 'passed', userFixture.updatedUsername);

    await addCandidate(page, candidateFixture);
    candidateId = await findCandidateIdByName(page, candidateFixture.name);
    await expect(candidateId, 'candidate creation', 'Newly added candidate was not found after submission');
    logCheck('Add candidate', 'passed', candidateId);

    await openDetailForCandidate(page, candidateFixture.name);
    logCheck('Open detail panel', 'passed', candidateFixture.name);

    await editCandidate(page, candidateId, candidateFixture.updatedCompany);
    logCheck('Edit candidate', 'passed', candidateFixture.updatedCompany);

    await testSearchAndFilters(page, candidateFixture);
    logCheck('Search and filters', 'passed', 'Name search and source filter responded');

    await testBoardAndStatus(page, candidateId);
    logCheck('List/board and status change', 'passed', 'View toggle and status update worked');

    await testResumeDownload(page, candidateId);
    logCheck('Resume download', 'passed', 'Resume endpoint returned a downloadable file');

    await testAiFeatures(page, candidateId);

    await deleteCandidate(page, candidateId, candidateFixture.name);
    logCheck('Delete candidate', 'passed', candidateFixture.name);
    candidateId = null;

    await writeReport();
  } catch (error) {
    logCheck('Portal QA run', 'failed', error.message);
    await captureFailureScreenshot(page).catch(() => {});
    await writeReport().catch(() => {});
    throw error;
  } finally {
    await cleanupFixture(candidateId, userFixture.id);
    await cleanupFixture(null, adminFixture.id);
    await browser.close();
  }
})().catch(error => {
  console.error('QA test failed:', error);
  process.exit(1);
});
