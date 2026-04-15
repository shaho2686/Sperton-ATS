let authToken = localStorage.getItem('srp_token') || null;
let currentUser = null;
let candidates = [];
let selectedCandidateId = null;
let editCandidateId = null;
let activeStatusFilter = '';
let addSkillsList = [];
let searchTimeout = null;
let lastAiAnalysis = null;
let lastOutreach = null;
let activeView = 'list';
let filterSkills = [];
let draggedCandidateId = null;
let pendingStatusChange = null;
/** @type {null | string | '__remove__'} pending profile photo (data URL or remove) */
let profilePendingAvatar = null;

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh',
  'Belgium','Brazil','Canada','Chile','China','Colombia','Czech Republic','Denmark',
  'Egypt','Estonia','Finland','France','Germany','Greece','Hungary','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kazakhstan',
  'Kenya','Kuwait','Latvia','Lebanon','Lithuania','Malaysia','Mexico','Morocco',
  'Nepal','Netherlands','New Zealand','Nigeria','Norway','Oman','Pakistan','Palestine',
  'Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia',
  'Singapore','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland',
  'Syria','Taiwan','Thailand','Turkey','Ukraine','UAE','United Kingdom','United States',
  'Uzbekistan','Venezuela','Vietnam','Yemen'
];

let selectedCountries = [];

const COMMON_SKILLS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby',
  'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js', 'Express.js', 'Django', 'Flask', 'Spring Boot',
  'Node.js', 'HTML', 'CSS', 'SASS', 'Tailwind CSS', 'Bootstrap', 'Material UI',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'GitLab CI',
  'Git', 'Linux', 'Agile', 'Scrum', 'Kanban', 'Jira', 'Confluence',
  'Machine Learning', 'Data Science', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy',
  'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator',
  'REST API', 'GraphQL', 'Microservices', 'Serverless', 'CI/CD'
];

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');

  if (!username || !password) {
    errorEl.textContent = 'Please enter both username and password.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('srp_token', data.token);
      localStorage.setItem('srp_user', JSON.stringify(data.user));
      showApp();
    } else {
      errorEl.textContent = data.error || 'Login failed.';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Connection error. Is the server running?';
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  localStorage.removeItem('srp_token');
  localStorage.removeItem('srp_user');
  localStorage.removeItem('srp_api_key');
  authToken = null;
  currentUser = null;
  location.reload();
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return headers;
}

function persistCurrentUser() {
  if (currentUser) localStorage.setItem('srp_user', JSON.stringify(currentUser));
}

function mergeUserFromApi(u) {
  if (!u) return;
  currentUser = {
    ...currentUser,
    id: u.id != null ? u.id : currentUser?.id,
    username: u.username || currentUser?.username,
    role: u.role || currentUser?.role,
    fullName: u.fullName != null ? u.fullName : (u.full_name != null ? u.full_name : currentUser?.fullName),
    apiKey: u.apiKey != null ? u.apiKey : (u.api_key != null ? u.api_key : currentUser?.apiKey),
    avatar: u.avatar !== undefined ? u.avatar : currentUser?.avatar
  };
}

function applyHeaderUser() {
  const welcome = document.getElementById('header-user-info');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarRole = document.getElementById('sidebar-user-role');
  const manageUsersBtn = document.getElementById('sidebar-manage-users-btn');
  const label = currentUser?.fullName || currentUser?.username || 'User';
  const roleLabel = currentUser?.role === 'admin' ? 'Administrator' : 'Recruiter';

  if (welcome) {
    welcome.innerHTML = `Signed in as <strong>${escapeHtml(label)}</strong> <span class="header-user-role">${roleLabel}</span>`;
  }
  if (sidebarName) {
    sidebarName.innerHTML = `<span>Signed in as</span><strong>${escapeHtml(label)}</strong>`;
  }
  if (sidebarRole) {
    sidebarRole.textContent = roleLabel;
  }
  if (manageUsersBtn) {
    manageUsersBtn.style.display = currentUser?.role === 'admin' ? 'block' : 'none';
  }

  const el = document.getElementById('header-avatar');
  if (!el) return;
  el.innerHTML = '';
  const av = currentUser?.avatar;
  if (av && typeof av === 'string' && av.startsWith('data:image/')) {
    el.classList.remove('no-image');
    el.removeAttribute('data-initial');
    const img = document.createElement('img');
    img.src = av;
    img.alt = '';
    el.appendChild(img);
  } else {
    const initial = (currentUser?.fullName || currentUser?.username || 'U')
      .trim().charAt(0).toUpperCase() || 'U';
    el.classList.add('no-image');
    el.setAttribute('data-initial', initial);
    el.setAttribute('aria-label', `${currentUser?.fullName || currentUser?.username || 'User'} avatar`);
  }
}

let teamPanelVisible = false;

function scrollToTeamSection() {
  const teamPanel = document.getElementById('team-panel');
  if (teamPanel) {
    teamPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function scrollToTeam() {
  const teamPanel = document.getElementById('team-panel');
  if (teamPanel) {
    teamPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    showToast('Team section is not available yet.', 'error');
  }
}

function toggleTeamArea() {
  teamPanelVisible = !teamPanelVisible;
  const panel = document.getElementById('team-panel');
  const button = document.getElementById('hero-team-toggle-btn');
  if (!panel || !button) return;
  panel.style.display = teamPanelVisible ? 'block' : 'none';
  button.textContent = teamPanelVisible ? 'Hide Smart Move' : 'Recruiter Smart Move';
  if (teamPanelVisible) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTeamPanel(usersList) {
  const panel = document.getElementById('team-panel');
  const content = document.getElementById('team-panel-content');
  if (!panel || !content) return;
  if (!usersList || usersList.length === 0) {
    content.innerHTML = `<div class="team-panel-empty">No team members yet. Use the button above to add a recruiter or administrator.</div>`;
    return;
  }

  content.innerHTML = usersList.map(u => {
    const name = escapeHtml(u.full_name || u.username || 'Unknown');
    const un = escapeHtml(u.username || '');
    const roleLabel = u.role === 'admin' ? 'Admin' : 'Recruiter';
    const isSelf = u.id == currentUser?.id;
    const selfBadge = isSelf ? '<span class="team-self">You</span>' : '';
    const actions = `<div class="team-actions">
      <button class="btn btn-sm btn-secondary" onclick="openEditUserModal('${u.id}', '${escapeHtml(u.full_name)}', '${escapeHtml(u.username)}', '${u.role}')">Edit</button>
      ${isSelf ? '' : `<button class="btn btn-sm btn-danger" onclick="openDeleteUserModal('${u.id}', '${escapeHtml(u.full_name)}')">Delete</button>`}
    </div>`;

    return `<div class="team-list-item">
      <div class="team-list-info">
        <div class="team-name">${name} ${selfBadge}</div>
        <div class="team-username">@${un}</div>
      </div>
      <div class="team-list-right">
        <span class="chip team-role-chip">${roleLabel}</span>
        ${actions}
      </div>
    </div>`;
  }).join('');
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';

  applyHeaderUser();

  const heroTeamBtn = document.getElementById('hero-team-toggle-btn');
  if (heroTeamBtn) {
    heroTeamBtn.style.display = currentUser?.role === 'admin' ? 'inline-flex' : 'none';
  }
  const teamPanel = document.getElementById('team-panel');
  if (teamPanel) {
    teamPanel.style.display = 'block';
    teamPanelVisible = true;
  }
  const teamAddMemberBtn = document.getElementById('team-add-member-btn');
  if (teamAddMemberBtn) teamAddMemberBtn.style.display = currentUser?.role === 'admin' ? 'inline-flex' : 'none';

  document.getElementById('sort-select').value = 'created_at';
  setView('list');

  loadDashboard();
  fetchCandidates();
}

async function apiFetch(url, options = {}) {
  const headers = getAuthHeaders();
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (res.status === 401) {
    showToast('Session expired. Please log in again.', 'error');
    handleLogout();
    throw new Error('Unauthorized');
  }
  return res;
}

async function loadDashboard() {
  try {
    const res = await apiFetch('/api/stats');
    const data = await res.json();
    if (!data.success) return;

    const { totalCandidates, statusBreakdown, topScored, marketBreakdown } = data.stats;

    let usersList = [];
    if (currentUser?.role === 'admin') {
      try {
        const usersRes = await apiFetch('/api/users');
        const usersJson = await usersRes.json();
        if (usersJson.success) usersList = usersJson.data || [];
      } catch (_e) {
        /* non-admin or network */
      }
    }

    const activePipeline = (statusBreakdown || [])
      .filter(s => ['new', 'screening', 'interview', 'technical', 'offer'].includes(s.status))
      .reduce((sum, s) => sum + s.count, 0);
    const closedPipeline = (statusBreakdown || [])
      .filter(s => ['hired', 'rejected'].includes(s.status))
      .reduce((sum, s) => sum + s.count, 0);
    const topMarket = marketBreakdown && marketBreakdown.length
      ? marketBreakdown.slice().sort((a, b) => b.count - a.count)[0]
      : null;
    const topCandidate = topScored && topScored.length ? topScored[0] : null;
    const teamSize = Array.isArray(usersList) ? usersList.length : 0;

    const heroTotal = document.getElementById('hero-kpi-total');
    const heroActive = document.getElementById('hero-kpi-active');
    const heroClosed = document.getElementById('hero-kpi-closed');
    const heroFocusText = document.getElementById('hero-focus-text');
    const heroFocusMeta = document.getElementById('hero-focus-meta');
    const heroMarketTag = document.getElementById('hero-market-tag');
    const heroTeamTag = document.getElementById('hero-team-tag');

    if (heroTotal) heroTotal.textContent = String(totalCandidates || 0);
    if (heroActive) heroActive.textContent = String(activePipeline || 0);
    if (heroClosed) heroClosed.textContent = String(closedPipeline || 0);
    if (heroFocusText) {
      heroFocusText.textContent = topCandidate
        ? `${topCandidate.full_name} leads with ${topCandidate.overall_score || 0}/10`
        : 'Pipeline is empty';
    }
    if (heroFocusMeta) {
      heroFocusMeta.textContent = topCandidate
        ? `${topCandidate.current_title || 'Candidate'} is currently the strongest profile in your shortlist.`
        : 'Start by adding a candidate and uploading a resume to activate scoring and outreach tools.';
    }
    if (heroMarketTag) heroMarketTag.textContent = `Top market: ${topMarket?.market || 'none'}`;
    if (heroTeamTag) heroTeamTag.textContent = `Team: ${teamSize || 0}`;

    let html = `
      <div class="snapshot-grid">
        <div class="snapshot-card accent-blue">
          <div class="snapshot-label">Total candidates</div>
          <div class="snapshot-value">${totalCandidates}</div>
          <div class="snapshot-meta">Profiles currently visible across your pipeline.</div>
        </div>
        <div class="snapshot-card accent-green">
          <div class="snapshot-label">Active pipeline</div>
          <div class="snapshot-value">${activePipeline}</div>
          <div class="snapshot-meta">Candidates moving through screening, interview, and offer.</div>
        </div>
      </div>
    `;

    html += `<div class="sidebar-section"><div class="sidebar-section-title">Pipeline status</div><div class="sidebar-section-sub">Watch where recruiting momentum is building up or slowing down.</div>`;
    const statusColors = {
      new: 'var(--blue-tag)', screening: 'var(--amber)', interview: '#125A86',
      technical: '#125A86', offer: 'var(--green)', hired: '#1f7d7a',
      rejected: 'var(--red)', on_hold: '#5c7287'
    };
    (statusBreakdown || []).forEach(s => {
      html += `<div class="dashboard-row dashboard-row-soft">
        <span class="status-badge status-${s.status}">${capitalize(s.status)}</span>
        <span class="dashboard-count" style="color:${statusColors[s.status] || 'var(--text)'}">${s.count}</span>
      </div>`;
    });
    html += `</div>`;

    if (marketBreakdown && marketBreakdown.length) {
      html += `<div class="sidebar-section"><div class="sidebar-section-title">Market hotspots</div><div class="sidebar-section-sub">See where most of your demand is concentrated right now.</div>`;
      marketBreakdown.slice(0, 5).forEach(m => {
        html += `<div class="dashboard-row dashboard-row-soft">
          <span style="font-size:12px;color:var(--text-secondary)">${m.market || 'Unknown'}</span>
          <span style="font-size:12px;font-weight:600">${m.count}</span>
        </div>`;
      });
      html += `</div>`;
    }

    if (topScored && topScored.length) {
      html += `<div class="sidebar-section"><div class="sidebar-section-title">Standout profiles</div><div class="sidebar-section-sub">Open the strongest candidates directly from the control rail.</div>`;
      topScored.slice(0, 4).forEach(c => {
        html += `<div class="dashboard-row dashboard-row-link" onclick="openDetail('${c.id}')">
          <span>
            <strong class="sidebar-link-name">${escapeHtml(c.full_name)}</strong>
            <span class="sidebar-link-meta">${escapeHtml(c.current_title || 'Candidate')}</span>
          </span>
          <span style="font-size:12px;font-weight:700;color:var(--green)">${c.overall_score}/10</span>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div class="sidebar-section"><div class="sidebar-section-title">Standout profiles</div><div class="team-panel-empty">Top scoring candidates will appear here after you add and analyze resumes.</div></div>`;
    }

    document.getElementById('sidebar-body').innerHTML = html;
    if (currentUser?.role === 'admin') {
      renderTeamPanel(usersList);
    } else {
      renderTeamPanel([]);
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

async function fetchCandidates() {
  try {
    const search = document.getElementById('search-input').value.trim();
    const sort = document.getElementById('sort-select').value;
    const params = new URLSearchParams({ limit: '50', sort, order: 'DESC' });

    if (search) params.set('search', search);
    if (activeStatusFilter) params.set('status', activeStatusFilter);
    const positionFilter = document.getElementById('filter-position')?.value.trim();
    if (positionFilter) params.set('position', positionFilter);

    const res = await apiFetch(`/api/candidates?${params}`);
    const data = await res.json();

    if (data.success) {
      candidates = data.data;
      renderFilterTags(data.statusSummary || {});
      renderCandidateList(getFilteredCandidates(candidates));
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => fetchCandidates(), 300);
}

function renderFilterTags(statusSummary) {
  const container = document.getElementById('filter-tags');
  const statuses = ['new', 'screening', 'interview', 'technical', 'offer', 'hired', 'rejected', 'on_hold'];

  let html = `<span class="filter-tag ${!activeStatusFilter ? 'active' : ''}" onclick="filterByStatus('')">All</span>`;
  statuses.forEach(s => {
    const count = statusSummary[s] || 0;
    if (count > 0) {
      html += `<span class="filter-tag ${activeStatusFilter === s ? 'active' : ''}" onclick="filterByStatus('${s}')">
        ${capitalize(s)} <span class="count">${count}</span>
      </span>`;
    }
  });
  container.innerHTML = html;
}

function filterByStatus(status) {
  activeStatusFilter = status;
  fetchCandidates();
}

function renderCandidateList(list) {
  const container = document.getElementById('results-list');
  if (!container) return;
  if (!list || list.length === 0) {
    const hasFilters = Boolean(
      document.getElementById('search-input')?.value.trim() ||
      activeStatusFilter ||
      document.getElementById('filter-position')?.value.trim() ||
      document.getElementById('filter-source')?.value ||
      document.getElementById('filter-score-min')?.value ||
      document.getElementById('filter-score-max')?.value ||
      document.getElementById('filter-exp-min')?.value ||
      document.getElementById('filter-exp-max')?.value ||
      filterSkills.length
    );
    container.classList.remove('board-view');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${hasFilters ? '&#128269;' : '&#10024;'}</div>
        <div class="empty-state-eyebrow">${hasFilters ? 'No matches in this view' : 'Pipeline is empty'}</div>
        <h3>${hasFilters ? 'Widen the search and try again' : 'Add your first candidate to activate the dashboard'}</h3>
        <p>${hasFilters ? 'The current search and filter combination is too narrow. Clear a few conditions or search with broader terms.' : 'Once you add candidates, this space will turn into a live recruiting workspace with list and board views, AI scoring, and outreach tools.'}</p>
        <div class="empty-state-actions">
          <button class="btn btn-primary" onclick="openAddCandidateModal()">+ Add Candidate</button>
          <button class="btn btn-secondary" onclick="${hasFilters ? `resetFilters(); fetchCandidates();` : `document.getElementById('search-input').focus();`}">${hasFilters ? 'Clear Filters' : 'Start Searching'}</button>
        </div>
      </div>`;
    return;
  }
  if (activeView === 'board') {
    container.classList.add('board-view');
    container.innerHTML = renderBoardView(list);
  } else {
    container.classList.remove('board-view');
    container.innerHTML = list.map(c => renderCard(c)).join('');
  }
}

function normalizeText(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getFilteredCandidates(list) {
  const source = document.getElementById('filter-source')?.value || '';
  const rawPosition = document.getElementById('filter-position')?.value || '';
  const position = normalizeText(rawPosition);
  const positionTerms = position ? position.split(/\s+/).filter(Boolean) : [];
  const scoreMin = parseFloat(document.getElementById('filter-score-min')?.value);
  const scoreMax = parseFloat(document.getElementById('filter-score-max')?.value);
  const expMin = parseFloat(document.getElementById('filter-exp-min')?.value);
  const expMax = parseFloat(document.getElementById('filter-exp-max')?.value);

  const base = Array.isArray(list) ? list : candidates;
  return base.filter(c => {
    if (source && (c.source || '').toLowerCase() !== source.toLowerCase()) return false;
    const candidatePosition = normalizeText(`${c.position || ''} ${c.current_title || ''} ${c.market || ''} ${c.current_company || ''}`);
    if (positionTerms.length && !positionTerms.every(term => candidatePosition.includes(term))) return false;
    if (!Number.isNaN(scoreMin) && (parseFloat(c.overall_score) || 0) < scoreMin) return false;
    if (!Number.isNaN(scoreMax) && (parseFloat(c.overall_score) || 0) > scoreMax) return false;
    if (!Number.isNaN(expMin) && (parseFloat(c.experience_years) || 0) < expMin) return false;
    if (!Number.isNaN(expMax) && (parseFloat(c.experience_years) || 0) > expMax) return false;
    if (filterSkills.length) {
      const skillMatches = Array.isArray(c.skills) ? c.skills : [];
      if (!filterSkills.every(skill => skillMatches.some(s => s.toLowerCase().includes(skill.toLowerCase())))) {
        return false;
      }
    }
    return true;
  });
}

function findCandidate(id) {
  const normalized = String(id);
  return candidates.find(x => String(x.id) === normalized);
}

function setView(view) {
  activeView = view === 'board' ? 'board' : 'list';
  document.getElementById('view-list-btn')?.classList.toggle('active', activeView === 'list');
  document.getElementById('view-board-btn')?.classList.toggle('active', activeView === 'board');
  renderCandidateList(getFilteredCandidates(candidates));
}

function renderBoardView(list) {
  const columns = [
    { status: 'new', label: 'New' },
    { status: 'screening', label: 'Screening' },
    { status: 'interview', label: 'Interview' },
    { status: 'offer', label: 'Offer' },
    { status: 'hired', label: 'Hired' },
    { status: 'rejected', label: 'Rejected' }
  ];
  return columns.map(col => renderBoardColumn(col.status, col.label, list.filter(c => c.status === col.status))).join('');
}

function renderBoardColumn(status, label, items) {
  return `
    <div class="board-column" ondragover="allowBoardDrop(event)" ondrop="dropOnBoardColumn(event, '${status}')">
      <div class="board-column-header">
        <span>${label}</span>
        <span class="board-column-count">${items.length}</span>
      </div>
      <div class="board-column-body">
        ${items.map(c => renderBoardCard(c)).join('')}
      </div>
    </div>`;
}

function renderBoardCard(c) {
  const initials = (c.full_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  return `
    <div class="board-card" id="board-card-${c.id}" draggable="true" ondragstart="startDrag(event, '${c.id}')" onclick="openDetail('${c.id}')">
      <div class="board-card-top">
        <div class="board-card-avatar">${initials}</div>
        <div class="board-card-text">
          <div class="board-card-name">${escapeHtml(c.full_name)}</div>
          <div class="board-card-title">${escapeHtml(c.current_title || '')}</div>
        </div>
        <div class="board-card-score">${c.overall_score || 0}</div>
      </div>
    </div>`;
}

function startDrag(event, id) {
  draggedCandidateId = id;
  event.dataTransfer.effectAllowed = 'move';
}

function allowBoardDrop(event) {
  event.preventDefault();
}

function dropOnBoardColumn(event, status) {
  event.preventDefault();
  if (!draggedCandidateId) return;
  const candidate = candidates.find(c => c.id === draggedCandidateId);
  if (!candidate || candidate.status === status) return;
  handleStatusChange(draggedCandidateId, status);
  draggedCandidateId = null;
}

function applyFilters() {
  renderCandidateList(getFilteredCandidates(candidates));
}

function resetFilters() {
  filterSkills = [];
  document.getElementById('filter-source').value = '';
  document.getElementById('filter-position').value = '';
  document.getElementById('filter-score-min').value = '';
  document.getElementById('filter-score-max').value = '';
  document.getElementById('filter-exp-min').value = '';
  document.getElementById('filter-exp-max').value = '';
  document.getElementById('filter-skills-input').value = '';
  renderFilterSkillTags();
  renderCandidateList(getFilteredCandidates(candidates));
}

function handleFilterSkillKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const raw = e.target.value.trim().replace(/,$/, '');
    if (raw && !filterSkills.includes(raw)) {
      filterSkills.push(raw);
      renderFilterSkillTags();
      renderCandidateList(getFilteredCandidates(candidates));
    }
    e.target.value = '';
  }
}

function renderFilterSkillTags() {
  const container = document.getElementById('filter-skills-container');
  if (!container) return;
  const input = document.getElementById('filter-skills-input');
  container.querySelectorAll('.tag').forEach(t => t.remove());
  filterSkills.forEach(skill => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${escapeHtml(skill)} <button type="button">&times;</button>`;
    tag.querySelector('button').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      filterSkills = filterSkills.filter(s => s !== skill);
      renderFilterSkillTags();
      renderCandidateList(getFilteredCandidates(candidates));
    });
    container.insertBefore(tag, input);
  });
}

function handleStatusChange(id, newStatus) {
  if (newStatus === 'rejected') {
    pendingStatusChange = { id, newStatus };
    openRejectionReasonModal();
    return;
  }
  updateStatus(id, newStatus);
}

function openRejectionReasonModal() {
  document.getElementById('rejection-reason-select').value = 'Not enough experience';
  document.getElementById('rejection-reason-other').value = '';
  document.getElementById('rejection-other-group').style.display = 'none';
  document.getElementById('rejection-modal').classList.add('open');
}

function closeRejectionReasonModal() {
  pendingStatusChange = null;
  document.getElementById('rejection-modal').classList.remove('open');
}

function toggleRejectionOther() {
  const select = document.getElementById('rejection-reason-select');
  document.getElementById('rejection-other-group').style.display = select.value === 'Other' ? 'block' : 'none';
}

function submitRejectionReason() {
  if (!pendingStatusChange) return;
  const change = pendingStatusChange;
  const selector = document.getElementById('rejection-reason-select');
  let reason = selector.value;
  if (reason === 'Other') {
    const other = document.getElementById('rejection-reason-other').value.trim();
    if (!other) {
      showToast('Please enter a rejection reason for Other.', 'error');
      return;
    }
    reason = other;
  }
  closeRejectionReasonModal();
  updateStatus(change.id, 'rejected', reason);
  pendingStatusChange = null;
}

async function findDuplicateCandidate({ email, phone, linkedin }) {
  const normalized = value => value?.trim().toLowerCase();
  const emailVal = normalized(email);
  const phoneVal = normalized(phone);
  const linkedinVal = normalized(linkedin);
  const exactMatch = candidates.find(c => c.id !== editCandidateId && (
    (emailVal && c.email?.trim().toLowerCase() === emailVal) ||
    (phoneVal && c.phone?.trim().toLowerCase() === phoneVal) ||
    (linkedinVal && c.linkedin_url?.trim().toLowerCase() === linkedinVal)
  ));
  if (exactMatch) return exactMatch;

  const values = [emailVal, phoneVal, linkedinVal].filter(Boolean);
  for (const value of values) {
    try {
      const res = await apiFetch(`/api/candidates?search=${encodeURIComponent(value)}&limit=20`);
      const data = await res.json();
      if (data.success) {
        const found = data.data.find(c => (
          (emailVal && c.email?.trim().toLowerCase() === emailVal) ||
          (phoneVal && c.phone?.trim().toLowerCase() === phoneVal) ||
          (linkedinVal && c.linkedin_url?.trim().toLowerCase() === linkedinVal)
        ));
        if (found) return found;
      }
    } catch (_err) {}
  }
  return null;
}

function renderCard(c) {
  const initials = (c.full_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const scoreClass = c.overall_score >= 8 ? 'high' : c.overall_score >= 5 ? 'mid' : 'low';
  const selected = selectedCandidateId === c.id ? ' selected' : '';
  const skills = Array.isArray(c.skills) ? c.skills.slice(0, 6) : [];
  const strengths = Array.isArray(c.strengths) ? c.strengths.slice(0, 3) : [];

  return `
    <div class="candidate-card${selected}" id="card-${c.id}" onclick="openDetail('${c.id}')">
      <div class="card-top">
        <div class="card-avatar">${initials}</div>
        <div class="card-info">
          <div class="card-name-row">
            <span class="card-name">${escapeHtml(c.full_name)}</span>
            <span class="status-badge status-${c.status}">${capitalize(c.status)}</span>
          </div>
          <div class="card-title">${escapeHtml(c.current_title || '')}${c.current_company ? ' &mdash; ' + escapeHtml(c.current_company) : ''}</div>
          <div class="card-meta">
            ${c.location ? '<span>&#128205; ' + escapeHtml(c.location) + '</span>' : ''}
            ${c.experience_years ? '<span>&#128188; ' + c.experience_years + ' yrs</span>' : ''}
            ${c.source ? '<span>&#127760; ' + capitalize(c.source) + '</span>' : ''}
          </div>
        </div>
        <div class="card-right">
          <div class="score-badge ${scoreClass}">
            <div class="score-num">${c.overall_score || 0}</div>
            <div class="badge-label">Score</div>
          </div>
        </div>
      </div>
      ${skills.length ? `<div class="card-chips">${skills.map(s => `<span class="chip chip-blue">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      ${strengths.length ? `<div class="card-chips">${strengths.map(s => `<span class="chip chip-green">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();openDetail('${c.id}')">View Profile</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();openEditCandidateModal('${c.id}')">Edit</button>
        <button class="btn btn-sm btn-success" onclick="event.stopPropagation();runAiAnalysis('${c.id}', { showModal: true })">AI Analyze</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();generateOutreach('${c.id}')">Outreach</button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();deleteCandidate('${c.id}')">Delete</button>
      </div>
    </div>`;
}

async function submitCandidate() {
  clearFieldErrors();

  const name = document.getElementById('add-name').value.trim();
  const email = document.getElementById('add-email').value.trim();
  const phone = document.getElementById('add-phone').value.trim();
  const title = document.getElementById('add-title').value.trim();

  let hasError = false;
  if (!name) { showFieldError('add-name-error', 'Candidate name is required.'); hasError = true; }
  if (!email) { showFieldError('add-email-error', 'Email is required.'); hasError = true; }
  else if (!/^\S+@\S+\.\S+$/.test(email)) { showFieldError('add-email-error', 'Enter a valid email address.'); hasError = true; }
  if (!phone) { showFieldError('add-phone-error', 'Phone number is required.'); hasError = true; }
  else if (!/^[0-9()+\s-]+$/.test(phone)) { showFieldError('add-phone-error', 'Use only numbers, +, -, parentheses, and spaces.'); hasError = true; }
  if (!title) { showFieldError('add-title-error', 'Current title is required.'); hasError = true; }
  if (hasError) {
    showToast('Please fix the required fields before submitting.', 'error');
    return;
  }

  const duplicate = await findDuplicateCandidate({
    email,
    phone,
    linkedin: document.getElementById('add-linkedin').value.trim()
  });

  if (duplicate && !editCandidateId) {
    const duplicateField = duplicate.email?.trim().toLowerCase() === email.toLowerCase() ? 'email'
      : duplicate.phone?.trim().toLowerCase() === phone.toLowerCase() ? 'phone'
      : 'LinkedIn';
    const message = `A candidate with this ${duplicateField} already exists: ${duplicate.full_name}`;
    if (!confirm(`${message}\n\nContinue and save anyway?`)) {
      return;
    }
  }

  const resumeFileInput = document.getElementById('add-resume-file');
  let resumeText = document.getElementById('add-resume').value.trim() || null;
  let resumeFileName = null;
  let resumeFileData = null;

  if (resumeFileInput?.files?.length) {
    const file = resumeFileInput.files[0];
    resumeFileName = file.name;
    try {
      if (file.type === 'text/plain') {
        resumeText = await file.text();
      }
      resumeFileData = await readFileAsBase64(file);
    } catch (_err) {
      console.warn('Could not read resume file:', _err);
    }
  }

  const body = {
    full_name: name,
    email,
    phone,
    current_title: title,
    current_company: document.getElementById('add-company').value.trim() || null,
    location: selectedCountries.length > 0 ? selectedCountries.join(', ') : null,
    experience_years: parseFloat(document.getElementById('add-experience').value) || null,
    position: document.getElementById('add-position').value.trim() || null,
    source: document.getElementById('add-source').value.trim() || null,
    linkedin_url: document.getElementById('add-linkedin').value.trim() || null,
    skills: addSkillsList,
    resume_text: resumeText,
    resume_file_name: resumeFileName,
    resume_file_data: resumeFileData,
    notes: document.getElementById('add-notes').value.trim() || null,
  };

  const btn = document.getElementById('add-submit-btn');
  btn.disabled = true;
  btn.textContent = editCandidateId ? 'Saving...' : 'Adding & Analyzing...';
  try {
    const url = editCandidateId ? `/api/candidates/${editCandidateId}` : '/api/candidates';
    const method = editCandidateId ? 'PUT' : 'POST';
    const res = await apiFetch(url, { method, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
      const candidateId = data.data?.id || editCandidateId;
      if (!editCandidateId && candidateId) {
        await fetchCandidates();
        await runAiAnalysis(candidateId, { autoApply: true, showModal: true });
      } else {
        showToast(editCandidateId ? 'Candidate updated!' : 'Candidate added!', 'success');
      }
      closeAddModal();
      if (!editCandidateId) await fetchCandidates();
      loadDashboard();
      if (editCandidateId && selectedCandidateId === editCandidateId) {
        openDetail(editCandidateId);
      }
    } else {
      showToast(data.error || 'Failed to save candidate.', 'error');
    }
  } catch (_err) {
    showToast('Failed to save candidate.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editCandidateId ? 'Save Changes' : 'Add Candidate & Analyze';
  }
}

async function openDetail(id) {
  let c = findCandidate(id);
  if (!c) {
    try {
      const res = await apiFetch(`/api/candidates/${id}`);
      const data = await res.json();
      if (data.success) {
        const idx = candidates.findIndex(x => x.id === id);
        if (idx >= 0) candidates[idx] = data.data;
        else candidates.push(data.data);
        c = data.data;
      } else {
        showToast('Failed to load candidate.', 'error');
        return;
      }
    } catch (_err) {
      showToast('Failed to load candidate details.', 'error');
      return;
    }
  }

  selectedCandidateId = id;
  document.getElementById('detail-panel').classList.add('open');

  document.querySelectorAll('.candidate-card').forEach(el => el.classList.remove('selected'));
  const card = document.getElementById(`card-${id}`);
  if (card) card.classList.add('selected');

  const skills = Array.isArray(c.skills) ? c.skills : [];
  const strengths = Array.isArray(c.strengths) ? c.strengths : [];
  const concerns = Array.isArray(c.concerns) ? c.concerns : [];
  let aiData = c.ai_analysis;
  if (typeof aiData === 'string') { try { aiData = JSON.parse(aiData); } catch { aiData = null; } }

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-header-info">
      <div class="card-avatar-lg">${(c.full_name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div class="detail-header-text">
        <div class="detail-name">${escapeHtml(c.full_name)}</div>
        <div class="detail-title">${escapeHtml(c.current_title || '')}</div>
        ${c.current_company ? `<div class="detail-company">${escapeHtml(c.current_company)}</div>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Status</div>
      <select class="status-select" style="width:100%" onchange="handleStatusChange('${c.id}', this.value)" id="detail-status">
        ${['new','screening','interview','technical','offer','hired','rejected','on_hold']
          .map(s => `<option value="${s}" ${c.status === s ? 'selected' : ''}>${capitalize(s)}</option>`).join('')}
      </select>
    </div>
    ${c.status === 'rejected' && c.rejection_reason ? `
    <div class="detail-section">
      <div class="detail-section-title">Rejection Reason</div>
      <div class="detail-notes">${escapeHtml(c.rejection_reason)}</div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-title">Evaluation</div>
      <div class="scores-grid">
        ${renderScoreBar('Technical', c.technical_score || 0)}
        ${renderScoreBar('Experience', c.experience_score || 0)}
        ${renderScoreBar('Culture Fit', c.culture_fit_score || 0)}
      </div>
      <div class="overall-score-row">
        <span class="overall-label">Overall Score</span>
        <span class="overall-value ${c.overall_score >= 8 ? 'score-high' : c.overall_score >= 5 ? 'score-mid' : 'score-low'}">${c.overall_score}/10</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Contact</div>
      <div class="info-grid">
        ${c.email ? `<div class="info-item"><span class="info-label">Email</span><span class="info-value"><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></span></div>` : ''}
        ${c.phone ? `<div class="info-item"><span class="info-label">Phone</span><span class="info-value">${escapeHtml(c.phone)}</span></div>` : ''}
        ${c.location ? `<div class="info-item"><span class="info-label">Location</span><span class="info-value">${escapeHtml(c.location)}</span></div>` : ''}
        ${c.linkedin_url ? `<div class="info-item"><span class="info-label">LinkedIn</span><span class="info-value"><a href="${escapeHtml(c.linkedin_url)}" target="_blank">View Profile &#8599;</a></span></div>` : ''}
        ${c.experience_years ? `<div class="info-item"><span class="info-label">Experience</span><span class="info-value">${c.experience_years} years</span></div>` : ''}
        ${c.source ? `<div class="info-item"><span class="info-label">Source</span><span class="info-value">${capitalize(c.source)}</span></div>` : ''}
      </div>
    </div>

    ${(c.position || c.market || c.assigned_recruiter) ? `
    <div class="detail-section">
      <div class="detail-section-title">Position</div>
      <div class="info-grid">
        ${c.position ? `<div class="info-item"><span class="info-label">Position</span><span class="info-value">${escapeHtml(c.position)}</span></div>` : ''}
        ${c.market ? `<div class="info-item"><span class="info-label">Market</span><span class="info-value">${escapeHtml(c.market)}</span></div>` : ''}
        ${c.assigned_recruiter ? `<div class="info-item"><span class="info-label">Recruiter</span><span class="info-value">${escapeHtml(c.assigned_recruiter)}</span></div>` : ''}
      </div>
    </div>` : ''}

    ${skills.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Skills</div>
      <div class="detail-chips">${skills.map(s => `<span class="chip chip-blue">${escapeHtml(s)}</span>`).join('')}</div>
    </div>` : ''}

    ${strengths.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Strengths</div>
      ${strengths.map(s => `<div class="list-item list-item-pos"><span>${escapeHtml(s)}</span></div>`).join('')}
    </div>` : ''}

    ${concerns.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Concerns</div>
      ${concerns.map(s => `<div class="list-item list-item-neg"><span>${escapeHtml(s)}</span></div>`).join('')}
    </div>` : ''}

    ${aiData ? `
    <div class="detail-section">
      <div class="ai-box">
        <div class="ai-box-title">&#129302; AI Analysis</div>
        <div class="ai-box-content">${escapeHtml(aiData.summary || '')}</div>
        ${aiData.recommendation ? `<div class="ai-recommendation ${aiData.fit_level || 'medium'}">${escapeHtml(aiData.recommendation)}</div>` : ''}
      </div>
    </div>` : ''}

    ${c.notes ? `
    <div class="detail-section">
      <div class="detail-section-title">Notes</div>
      <div class="detail-notes">${escapeHtml(c.notes)}</div>
    </div>` : ''}

    ${c.job_description ? `
    <div class="detail-section">
      <div class="detail-section-title">Job Description (Match context)</div>
      <div class="detail-notes" style="background:#E2E1DF; font-size:11px">${escapeHtml(c.job_description)}</div>
    </div>` : ''}

    ${c.resume_file_name ? `
    <div class="detail-section">
      <div class="detail-section-header">
        <div class="detail-section-title">Resume File</div>
        ${c.resume_file_available ? `<button class="btn btn-sm btn-secondary detail-download-btn" onclick="downloadResume('${c.id}', '${escapeHtml(c.full_name || 'candidate').replace(/'/g, "\\'")}')">&#x2193; Download</button>` : ''}
      </div>
      <div class="detail-notes" style="background:#f7f6f3; font-size:12px">Uploaded file: ${escapeHtml(c.resume_file_name)}</div>
      ${c.resume_file_available ? '' : `<div class="detail-notes" style="margin-top:8px; background:#fff3cd; color:#7a5d00; font-size:12px">Resume file reference exists, but the file data is no longer available.</div>`}
    </div>` : ''}

    ${c.resume_text ? `
    <div class="detail-section">
      <div class="detail-section-header">
        <div class="detail-section-title">Resume Content</div>
        <button class="btn btn-sm btn-secondary detail-download-btn" onclick="downloadResume('${c.id}', '${escapeHtml(c.full_name || 'candidate').replace(/'/g, "\\'")}')">&#x2193; Download</button>
      </div>
      <div class="detail-notes" style="background:#ebeae8; font-family:monospace; font-size:11px; white-space:pre-wrap">${escapeHtml(c.resume_text)}</div>
    </div>` : ''}

    <div class="detail-actions">
      <button type="button" class="btn btn-primary" onclick="openEditCandidateModal('${c.id}')">&#9998; Edit</button>
      <button type="button" class="btn btn-success" onclick="runAiAnalysis('${c.id}', { showModal: true })">&#129302; AI Analyze</button>
      <button type="button" class="btn btn-secondary" onclick="generateOutreach('${c.id}')">&#9993; Outreach</button>
      <button type="button" class="btn btn-danger" onclick="deleteCandidate('${c.id}')">&#128465; Delete</button>
    </div>
  `;
}

function closeDetail() {
  selectedCandidateId = null;
  document.getElementById('detail-panel').classList.remove('open');
  document.querySelectorAll('.candidate-card').forEach(el => el.classList.remove('selected'));
}

function renderScoreBar(label, score) {
  const color = score >= 8 ? 'green' : score >= 5 ? 'amber' : 'red';
  return `
    <div class="score-row">
      <span class="score-label">${label}</span>
      <div class="score-bar"><div class="score-fill ${color}" style="width:${score * 10}%"></div></div>
      <span class="score-value">${score}</span>
    </div>`;
}

async function updateStatus(id, newStatus, rejectionReason = null) {
  try {
    const res = await apiFetch(`/api/candidates/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus, rejection_reason: rejectionReason })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      fetchCandidates();
      loadDashboard();
    } else {
      showToast(data.error || 'Failed to update status.', 'error');
      const sel = document.getElementById('detail-status');
      if (sel) { const c = findCandidate(id); if (c) sel.value = c.status; }
    }
  } catch (_err) { showToast('Failed to update status.', 'error'); }
}

async function deleteCandidate(id) {
  const c = findCandidate(id);
  if (!c) return;
  if (!confirm(`Delete "${c.full_name}"? This cannot be undone.`)) return;
  try {
    const res = await apiFetch(`/api/candidates/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); closeDetail(); fetchCandidates(); loadDashboard(); }
    else showToast(data.error, 'error');
  } catch (_err) { showToast('Failed to delete.', 'error'); }
}

function openAddCandidateModal() {
  editCandidateId = null;
  document.getElementById('add-modal-title').textContent = 'Add New Candidate';
  document.getElementById('add-submit-btn').textContent = 'Add Candidate & Analyze';
  document.getElementById('add-modal').classList.add('open');
  ['add-name','add-email','add-phone','add-title','add-company','add-experience',
   'add-position','add-source','add-linkedin','add-notes',
   'add-resume'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const resumeFile = document.getElementById('add-resume-file');
  if (resumeFile) resumeFile.value = '';
  const resumeFileNote = document.getElementById('resume-file-note');
  if (resumeFileNote) resumeFileNote.textContent = 'Upload a resume file for candidate records.';
  addSkillsList = [];
  selectedCountries = [];
  renderAddSkills();
  renderCountryTags();
  clearFieldErrors();
}

function closeAddModal() { document.getElementById('add-modal').classList.remove('open'); }

function openAddUserModal() {
  if (currentUser?.role !== 'admin') return;
  clearUserFieldErrors();
  document.getElementById('user-full-name').value = '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = 'recruiter';
  document.getElementById('add-user-modal').classList.add('open');
}

function closeAddUserModal() {
  document.getElementById('add-user-modal').classList.remove('open');
}

function clearUserFieldErrors() {
  ['user-full-name-error', 'user-username-error', 'user-password-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

async function submitUser() {
  if (currentUser?.role !== 'admin') return;
  clearUserFieldErrors();
  const fullName = document.getElementById('user-full-name').value.trim();
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const role = document.getElementById('user-role').value;

  let hasError = false;
  if (!fullName) {
    document.getElementById('user-full-name-error').textContent = 'Required.';
    hasError = true;
  }
  if (!username) {
    document.getElementById('user-username-error').textContent = 'Required.';
    hasError = true;
  }
  if (!password) {
    document.getElementById('user-password-error').textContent = 'Required.';
    hasError = true;
  } else if (password.length < 6) {
    document.getElementById('user-password-error').textContent = 'At least 6 characters.';
    hasError = true;
  }
  if (hasError) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  const btn = document.getElementById('user-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, username, password, role })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'User created successfully.', 'success');
      closeAddUserModal();
      loadDashboard();
    } else {
      if ((data.error || '').toLowerCase().includes('username')) {
        document.getElementById('user-username-error').textContent = data.error;
      }
      showToast(data.error || 'Failed to create user.', 'error');
    }
  } catch (_err) {
    showToast('Failed to create user.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create user';
  }
}

function openEditUserModal(id, fullName, username, role) {
  if (currentUser?.role !== 'admin') return;
  clearEditUserFieldErrors();
  document.getElementById('edit-user-full-name').value = unescapeHtml(fullName);
  document.getElementById('edit-user-username').value = unescapeHtml(username);
  document.getElementById('edit-user-role').value = role;
  document.getElementById('edit-user-modal').dataset.userId = id;
  document.getElementById('edit-user-modal').classList.add('open');
}

function closeEditUserModal() {
  document.getElementById('edit-user-modal').classList.remove('open');
}

function clearEditUserFieldErrors() {
  ['edit-user-full-name-error', 'edit-user-username-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

async function submitEditUser() {
  if (currentUser?.role !== 'admin') return;
  clearEditUserFieldErrors();
  const id = document.getElementById('edit-user-modal').dataset.userId;
  const fullName = document.getElementById('edit-user-full-name').value.trim();
  const username = document.getElementById('edit-user-username').value.trim();
  const role = document.getElementById('edit-user-role').value;

  let hasError = false;
  if (!fullName) {
    document.getElementById('edit-user-full-name-error').textContent = 'Required.';
    hasError = true;
  }
  if (!username) {
    document.getElementById('edit-user-username-error').textContent = 'Required.';
    hasError = true;
  }
  if (hasError) {
    showToast('Please fix the highlighted fields.', 'error');
    return;
  }

  const btn = document.getElementById('edit-user-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Updating...';
  try {
    const res = await apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ fullName, username, role })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'User updated successfully.', 'success');
      closeEditUserModal();
      // If updated self, refresh current user
      if (id == currentUser.id) {
        currentUser.fullName = fullName;
        currentUser.username = username;
        currentUser.role = role;
        localStorage.setItem('srp_user', JSON.stringify(currentUser));
        applyHeaderUser();
      }
      loadDashboard();
    } else {
      if ((data.error || '').toLowerCase().includes('username')) {
        document.getElementById('edit-user-username-error').textContent = data.error;
      }
      showToast(data.error || 'Failed to update user.', 'error');
    }
  } catch (_err) {
    showToast('Failed to update user.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update user';
  }
}

function openDeleteUserModal(id, fullName) {
  if (currentUser?.role !== 'admin') return;
  document.getElementById('delete-user-name').textContent = unescapeHtml(fullName);
  document.getElementById('delete-user-modal').dataset.userId = id;
  document.getElementById('delete-user-modal').classList.add('open');
}

function closeDeleteUserModal() {
  document.getElementById('delete-user-modal').classList.remove('open');
}

async function submitDeleteUser() {
  if (currentUser?.role !== 'admin') return;
  const id = document.getElementById('delete-user-modal').dataset.userId;

  const btn = document.getElementById('delete-user-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  try {
    const res = await apiFetch(`/api/users/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'User deleted successfully.', 'success');
      closeDeleteUserModal();
      loadDashboard();
    } else {
      showToast(data.error || 'Failed to delete user.', 'error');
    }
  } catch (_err) {
    showToast('Failed to delete user.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete user';
  }
}

async function openProfileModal() {
  profilePendingAvatar = null;
  document.getElementById('profile-full-name-error').textContent = '';
  document.getElementById('profile-password-error').textContent = '';
  ['profile-current-password', 'profile-new-password', 'profile-confirm-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const photoIn = document.getElementById('profile-photo-input');
  if (photoIn) photoIn.value = '';

  try {
    const res = await apiFetch('/api/auth/me');
    const data = await res.json();
    if (data.success && data.user) {
      mergeUserFromApi({
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        fullName: data.user.full_name,
        avatar: data.user.avatar
      });
      persistCurrentUser();
    }
  } catch (_e) {}

  document.getElementById('profile-full-name').value = currentUser?.fullName || '';
  document.getElementById('profile-username').value = currentUser?.username || '';
  document.getElementById('profile-role').value = currentUser?.role === 'admin' ? 'Administrator' : 'Recruiter';
  const rm = document.getElementById('profile-remove-photo-btn');
  if (rm) {
    rm.style.display =
      currentUser?.avatar && String(currentUser.avatar).startsWith('data:') ? 'inline-flex' : 'none';
  }
  renderProfilePreview();
  document.getElementById('profile-modal').classList.add('open');
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('open');
  profilePendingAvatar = null;
}

function renderProfilePreview() {
  const box = document.getElementById('profile-avatar-preview');
  if (!box) return;
  box.innerHTML = '';
  let src = null;
  if (profilePendingAvatar && profilePendingAvatar.startsWith('data:')) {
    src = profilePendingAvatar;
  } else if (profilePendingAvatar !== '__remove__' && currentUser?.avatar && String(currentUser.avatar).startsWith('data:')) {
    src = currentUser.avatar;
  }
  if (src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    box.appendChild(img);
  } else {
    const raw = (document.getElementById('profile-full-name')?.value || currentUser?.fullName || currentUser?.username || 'U').trim();
    const initials = raw.split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 3);
    box.textContent = initials || 'U';
  }
}

function onProfilePhotoSelected(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  if (!f.type.startsWith('image/')) {
    showToast('Please choose an image file.', 'error');
    return;
  }
  if (f.size > 2_200_000) {
    showToast('Image is too large. Use a file under 2 MB.', 'error');
    ev.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    profilePendingAvatar = reader.result;
    renderProfilePreview();
    const rmBtn = document.getElementById('profile-remove-photo-btn');
    if (rmBtn) rmBtn.style.display = 'inline-flex';
  };
  reader.readAsDataURL(f);
}

function clearProfilePhoto() {
  profilePendingAvatar = '__remove__';
  const input = document.getElementById('profile-photo-input');
  if (input) input.value = '';
  renderProfilePreview();
  const rmBtn = document.getElementById('profile-remove-photo-btn');
  if (rmBtn) rmBtn.style.display = 'none';
}

async function saveProfile() {
  document.getElementById('profile-full-name-error').textContent = '';
  document.getElementById('profile-password-error').textContent = '';

  const fullName = document.getElementById('profile-full-name').value.trim();
  if (!fullName) {
    document.getElementById('profile-full-name-error').textContent = 'Required.';
    showToast('Please enter your full name.', 'error');
    return;
  }

  const curPw = document.getElementById('profile-current-password').value;
  const newPw = document.getElementById('profile-new-password').value;
  const confPw = document.getElementById('profile-confirm-password').value;
  const anyPw = !!(curPw || newPw || confPw);
  if (anyPw) {
    if (!curPw || !newPw) {
      document.getElementById('profile-password-error').textContent = 'Enter both current and new password.';
      return;
    }
    if (newPw !== confPw) {
      document.getElementById('profile-password-error').textContent = 'New passwords do not match.';
      return;
    }
    if (newPw.length < 6) {
      document.getElementById('profile-password-error').textContent = 'New password must be at least 6 characters.';
      return;
    }
  }

  const btn = document.getElementById('profile-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const resName = await apiFetch('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ fullName })
    });
    const dataName = await resName.json();
    if (!dataName.success) {
      showToast(dataName.error || 'Could not update profile.', 'error');
      return;
    }
    mergeUserFromApi(dataName.user);

    if (profilePendingAvatar === '__remove__') {
      const ar = await apiFetch('/api/auth/avatar', {
        method: 'POST',
        body: JSON.stringify({ clear: true })
      });
      const ad = await ar.json();
      if (!ad.success) {
        showToast(ad.error || 'Could not remove photo.', 'error');
        return;
      }
      mergeUserFromApi(ad.user);
    } else if (profilePendingAvatar && profilePendingAvatar.startsWith('data:image/')) {
      const ar = await apiFetch('/api/auth/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar: profilePendingAvatar })
      });
      const ad = await ar.json();
      if (!ad.success) {
        showToast(ad.error || 'Could not save photo.', 'error');
        return;
      }
      mergeUserFromApi(ad.user);
    }

    if (anyPw) {
      const pr = await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw })
      });
      const pd = await pr.json();
      if (!pd.success) {
        showToast(pd.error || 'Password not updated.', 'error');
        return;
      }
    }

    profilePendingAvatar = null;
    persistCurrentUser();
    applyHeaderUser();
    closeProfileModal();
    showToast(anyPw ? 'Profile and password saved.' : 'Profile saved.', 'success');
  } catch (_err) {
    showToast('Failed to save profile.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
}

function openEditCandidateModal(id) {
  const c = findCandidate(id);
  if (!c) return;
  editCandidateId = id;
  document.getElementById('add-modal-title').textContent = 'Edit Candidate';
  document.getElementById('add-submit-btn').textContent = 'Save Changes';
  
  document.getElementById('add-name').value = c.full_name || '';
  document.getElementById('add-email').value = c.email || '';
  document.getElementById('add-phone').value = c.phone || '';
  document.getElementById('add-title').value = c.current_title || '';
  document.getElementById('add-company').value = c.current_company || '';
  document.getElementById('add-experience').value = c.experience_years || '';
  document.getElementById('add-position').value = c.position || '';
  document.getElementById('add-source').value = c.source || '';
  document.getElementById('add-linkedin').value = c.linkedin_url || '';
  document.getElementById('add-notes').value = c.notes || '';
  document.getElementById('add-resume').value = c.resume_text || '';
  const resumeFile = document.getElementById('add-resume-file');
  if (resumeFile) resumeFile.value = '';
  const resumeFileNote = document.getElementById('resume-file-note');
  if (resumeFileNote) {
    resumeFileNote.textContent = c.resume_file_name ? `Existing upload: ${c.resume_file_name}` : 'Upload a resume file for candidate records.';
  }
  
  addSkillsList = Array.isArray(c.skills) ? [...c.skills] : [];
  selectedCountries = c.location ? c.location.split(',').map(s=>s.trim()).filter(Boolean) : [];
  
  renderAddSkills();
  renderCountryTags();
  
  document.getElementById('add-modal').classList.add('open');
}

const skillsInput = document.getElementById('add-skills-input');
if (skillsInput) {
  skillsInput.addEventListener('keydown', function(e) {
    const suggestions = document.getElementById('skills-suggestions');
    const highlighted = suggestions.querySelector('.highlighted');
    
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); e.stopPropagation();
      const val = this.value.trim().replace(/,$/, '');
      if (val && !addSkillsList.includes(val)) { addSkillsList.push(val); renderAddSkills(); }
      this.value = '';
      hideSkillsSuggestions();
    } else if (e.key === 'Backspace' && !this.value && addSkillsList.length) {
      addSkillsList.pop(); renderAddSkills();
    } else if (e.key === 'ArrowDown' && suggestions.style.display === 'block') {
      e.preventDefault();
      if (highlighted) {
        const next = highlighted.nextElementSibling || suggestions.querySelector('.suggestion-item');
        highlighted.classList.remove('highlighted');
        if (next) next.classList.add('highlighted');
      } else {
        const first = suggestions.querySelector('.suggestion-item');
        if (first) first.classList.add('highlighted');
      }
    } else if (e.key === 'ArrowUp' && suggestions.style.display === 'block') {
      e.preventDefault();
      if (highlighted) {
        const prev = highlighted.previousElementSibling || suggestions.querySelector('.suggestion-item:last-child');
        highlighted.classList.remove('highlighted');
        if (prev) prev.classList.add('highlighted');
      }
    } else if (e.key === 'Escape') {
      hideSkillsSuggestions();
    }
  });
  
  skillsInput.addEventListener('input', function() {
    const val = this.value.trim().toLowerCase();
    if (val.length >= 2) {
      showSkillsSuggestions(val);
    } else {
      hideSkillsSuggestions();
    }
  });
  
  skillsInput.addEventListener('blur', function() {
    // Delay hiding to allow clicks on suggestions
    setTimeout(hideSkillsSuggestions, 150);
  });
  
  skillsInput.addEventListener('paste', function(e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    pasted.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(item => {
      if (!addSkillsList.includes(item)) addSkillsList.push(item);
    });
    renderAddSkills(); this.value = '';
    hideSkillsSuggestions();
  });
}

const profileNameInput = document.getElementById('profile-full-name');
if (profileNameInput) {
  profileNameInput.addEventListener('input', () => {
    if (profilePendingAvatar === null || profilePendingAvatar === '__remove__') renderProfilePreview();
  });
}

function renderAddSkills() {
  const container = document.getElementById('add-skills-container');
  if (!container) return;
  const input = container.querySelector('input');
  if (!input) return;
  container.querySelectorAll('.tag').forEach(t => t.remove());
  addSkillsList.forEach(skill => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${escapeHtml(skill)} <button type="button">&times;</button>`;
    tag.querySelector('button').addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      addSkillsList = addSkillsList.filter(s => s !== skill); renderAddSkills();
    });
    container.insertBefore(tag, input);
  });
}

function showSkillsSuggestions(query) {
  const suggestions = document.getElementById('skills-suggestions');
  const list = document.getElementById('skills-suggestions-list');
  if (!suggestions || !list) return;
  
  const matches = COMMON_SKILLS.filter(skill => 
    skill.toLowerCase().includes(query) && !addSkillsList.includes(skill)
  ).slice(0, 10);
  
  if (matches.length === 0) {
    suggestions.style.display = 'none';
    return;
  }
  
  list.innerHTML = matches.map(skill => 
    `<div class="suggestion-item" onclick="selectSkill('${skill.replace(/'/g, "\\'")}')">${escapeHtml(skill)}</div>`
  ).join('');
  
  suggestions.style.display = 'block';
}

function hideSkillsSuggestions() {
  const suggestions = document.getElementById('skills-suggestions');
  if (suggestions) suggestions.style.display = 'none';
}

function selectSkill(skill) {
  if (!addSkillsList.includes(skill)) {
    addSkillsList.push(skill);
    renderAddSkills();
  }
  const input = document.getElementById('add-skills-input');
  if (input) input.value = '';
  hideSkillsSuggestions();
  input.focus();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.substring(commaIndex + 1) : result);
      } else {
        const bytes = new Uint8Array(result);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        resolve(btoa(binary));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getMimeTypeFromFilename(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function getDownloadFilename(candidate, fallbackName, contentDisposition) {
  const headerMatch = contentDisposition && contentDisposition.match(/filename="?([^";]+)"?/i);
  if (headerMatch && headerMatch[1]) {
    return decodeURIComponent(headerMatch[1]);
  }

  if (candidate?.resume_file_name) {
    return candidate.resume_file_name;
  }

  return `${fallbackName.replace(/[^a-zA-Z0-9]/g, '_')}_resume.txt`;
}

async function downloadResume(candidateId, candidateName) {
  const c = findCandidate(candidateId);
  if (!c) {
    showToast('Candidate not found.', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/api/candidates/${candidateId}/resume?download=1`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error || 'No resume available for download.', 'error');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getDownloadFilename(c, candidateName, res.headers.get('content-disposition'));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (_err) {
    showToast('Failed to download resume.', 'error');
  }
}

function toggleCountryDropdown() {
  const dropdown = document.getElementById('country-dropdown');
  if (!dropdown) return;
  const isVisible = dropdown.style.display === 'block';
  dropdown.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) {
    document.getElementById('country-search').value = '';
    renderCountryOptions('');
    document.getElementById('country-search').focus();
  }
}

function filterCountries() {
  const q = document.getElementById('country-search').value.trim().toLowerCase();
  renderCountryOptions(q);
}

function renderCountryOptions(filter) {
  const list = document.getElementById('country-list');
  if (!list) return;
  const filtered = filter ? COUNTRIES.filter(c => c.toLowerCase().includes(filter)) : COUNTRIES;
  list.innerHTML = filtered.map(c => {
    const checked = selectedCountries[0] === c ? 'checked' : '';
    return `<label class="country-option ${checked ? 'selected' : ''}">
      <input type="radio" name="country" ${checked} onchange="selectCountry('${c.replace(/'/g, "\\'")}')">
      ${escapeHtml(c)}
    </label>`;
  }).join('');
}

function selectCountry(country) {
  selectedCountries = [country];
  renderCountryTags();
  const q = document.getElementById('country-search')?.value?.trim().toLowerCase() || '';
  renderCountryOptions(q);
}

function renderCountryTags() {
  const container = document.getElementById('country-tags');
  if (!container) return;
  if (selectedCountries.length === 0) {
    container.innerHTML = '<span class="country-placeholder">Select country...</span>';
    return;
  }
  container.innerHTML = selectedCountries.map(c =>
    `<span class="country-tag">${escapeHtml(c)} <button type="button" onclick="event.preventDefault();event.stopPropagation();selectCountry('${c.replace(/'/g, "\\'")}')">&times;</button></span>`
  ).join('');
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('country-dropdown');
  const trigger = document.getElementById('country-trigger');
  if (dropdown && trigger && !trigger.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

function clearFieldErrors() {
  ['add-name-error','add-email-error','add-phone-error','add-title-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
    const inputId = id.replace('-error', '');
    const input = document.getElementById(inputId);
    if (input) input.classList.remove('invalid');
  });
}

function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
  const inputId = id.replace('-error', '');
  const input = document.getElementById(inputId);
  if (input) input.classList.add('invalid');
}

async function runAiAnalysis(candidateId, options = {}) {
  const { autoApply = false, showModal = false } = options;
  const c = findCandidate(candidateId);
  if (!c) { showToast('Candidate not found.', 'error'); return; }
  if (!c.full_name && !c.current_title && !c.skills?.length) {
    showToast('Cannot analyze: no name, title, or skills.', 'error'); return;
  }

  if (showModal) {
    document.getElementById('ai-modal').classList.add('open');
    document.getElementById('ai-modal-meta').textContent = `${c.full_name} — ${c.current_title || ''}`;
    document.getElementById('ai-modal-content').innerHTML = `
      <div class="loading"><div class="spinner"></div>
      <span>Analyzing candidate with Groq AI...</span></div>`;
    document.getElementById('ai-modal-actions').style.display = 'none';
  }

  try {
    const res = await apiFetch('/api/ai/analyze', {
      method: 'POST', body: JSON.stringify({ candidateId, position: c.position || c.current_title })
    });
    const data = await res.json();
    if (data.success) {
      lastAiAnalysis = { candidateId, analysis: data.analysis };
      renderAiResult(data.analysis);
      if (autoApply) {
        await applyAiScores({ autoClose: true, silent: true });
      }
    } else {
      document.getElementById('ai-modal-content').innerHTML = `
        <div class="error-box">${escapeHtml(data.error || 'AI analysis failed.')}</div>
        <p class="error-hint">Make sure GROQ_API_KEY is set in the .env file.</p>`;
    }
  } catch (_err) {
    if (showModal) {
      document.getElementById('ai-modal-content').innerHTML = `<div class="error-box">Connection error. Is the server running?</div>`;
    } else {
      showToast('AI analysis failed.', 'error');
    }
  }
}

function renderAiResult(analysis) {
  const fitColors = { very_high: 'high', high: 'high', medium: 'medium', low: 'low' };
  const fitLabels = { very_high: 'Very High Fit', high: 'High Fit', medium: 'Medium Fit', low: 'Low Fit' };

  document.getElementById('ai-modal-content').innerHTML = `
    <div class="ai-box">
      <div class="ai-box-title">&#129302; AI Analysis Result</div>
      <div class="ai-box-content">${escapeHtml(analysis.summary || '')}</div>
      <div class="ai-recommendation ${fitColors[analysis.fit_level] || 'medium'}">
        ${escapeHtml(fitLabels[analysis.fit_level] || '')} — ${escapeHtml(analysis.recommendation || '')}
      </div>
    </div>

    <div class="detail-section" style="margin-top:16px">
      <div class="detail-section-title">Suggested Scores</div>
      <div class="scores-grid">
        ${renderScoreBar('Technical', analysis.suggested_technical_score || 0)}
        ${renderScoreBar('Experience', analysis.suggested_experience_score || 0)}
        ${renderScoreBar('Culture Fit', analysis.suggested_culture_fit_score || 0)}
      </div>
    </div>

    ${analysis.strengths?.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Strengths</div>
      ${analysis.strengths.map(s => `<div class="list-item list-item-pos"><span>${escapeHtml(s)}</span></div>`).join('')}
    </div>` : ''}

    ${analysis.concerns?.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Concerns</div>
      ${analysis.concerns.map(s => `<div class="list-item list-item-neg"><span>${escapeHtml(s)}</span></div>`).join('')}
    </div>` : ''}

    ${analysis.interview_questions?.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Interview Questions</div>
      ${analysis.interview_questions.map((q, i) => `<div class="question-item"><strong>${i + 1}.</strong> ${escapeHtml(q)}</div>`).join('')}
    </div>` : ''}
  `;
  document.getElementById('ai-modal-actions').style.display = 'flex';
}

async function applyAiScores(options = {}) {
  const { autoClose = false, silent = false } = options;
  if (!lastAiAnalysis) return;
  const { candidateId, analysis } = lastAiAnalysis;

  const tech = analysis.suggested_technical_score || 0;
  const exp = analysis.suggested_experience_score || 0;
  const culture = analysis.suggested_culture_fit_score || 0;
  const overall = Math.round((tech + exp + culture) / 3 * 10) / 10;

  try {
    const res = await apiFetch(`/api/candidates/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify({
        technical_score: tech, experience_score: exp, culture_fit_score: culture,
        overall_score: overall, strengths: analysis.strengths || [], concerns: analysis.concerns || []
      })
    });
    const data = await res.json();
    if (data.success) {
      if (!silent) showToast('AI scores applied!', 'success');
      if (autoClose) closeModal('ai-modal');
      await fetchCandidates();
      openDetail(candidateId);
      loadDashboard();
    } else { if (!silent) showToast(data.error || 'Failed to apply.', 'error'); }
  } catch (_err) { showToast('Failed to apply scores.', 'error'); }
}

async function generateOutreach(candidateId) {
  const c = findCandidate(candidateId);
  if (!c) { showToast('Candidate not found.', 'error'); return; }
  if (!c.full_name) { showToast('Cannot generate: no candidate name.', 'error'); return; }

  document.getElementById('outreach-modal').classList.add('open');
  document.getElementById('outreach-modal-meta').textContent = `${c.full_name} — ${c.current_title || ''}`;
  document.getElementById('outreach-modal-content').innerHTML = `
    <div class="loading"><div class="spinner"></div>
    <span>Generating personalized outreach...</span></div>`;
  document.getElementById('outreach-modal-actions').style.display = 'none';

  try {
    const res = await apiFetch('/api/ai/outreach', {
      method: 'POST',
      body: JSON.stringify({ candidateId, position: c.position || c.current_title, clientCompany: 'Sperton Client' })
    });
    const data = await res.json();
    if (data.success) {
      lastOutreach = data.outreach;
      let messageText = data.outreach.message || '';
      messageText = messageText.replace(/\\n/g, '\n');
      const safeText = escapeHtml(messageText);
      const messageHtml = safeText.replace(/\n/g, '<br>');
      const keyPoints = Array.isArray(data.outreach.key_points)
        ? data.outreach.key_points.map(p => `<li>${escapeHtml(p)}</li>`).join('')
        : '';

      document.getElementById('outreach-modal-content').innerHTML = `
        <div class="outreach-section">
          <div class="outreach-label">Subject Line</div>
          <div class="outreach-subject">${escapeHtml(data.outreach.subject || '')}</div>
        </div>
        <div class="outreach-section">
          <div class="outreach-label">Message</div>
          <div class="outreach-message">${messageHtml}</div>
        </div>
        ${keyPoints ? `
        <div class="outreach-section">
          <div class="outreach-label">Key Points</div>
          <ul class="outreach-keypoints">${keyPoints}</ul>
        </div>` : ''}
      `;
      document.getElementById('outreach-modal-actions').style.display = 'flex';
    } else {
      document.getElementById('outreach-modal-content').innerHTML = `<div class="error-box">${escapeHtml(data.error || 'Failed.')}</div>`;
    }
  } catch (_err) {
    document.getElementById('outreach-modal-content').innerHTML = `<div class="error-box">Connection error.</div>`;
  }
}

function copyOutreach() {
  if (!lastOutreach) return;
  const messageText = (lastOutreach.message || '').replace(/\\n/g, '\n');
  const text = `Subject: ${lastOutreach.subject || ''}\n\n${messageText}`;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success')).catch(() => showToast('Copy failed. Please select and copy manually.', 'error'));
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('open'); });
});

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function unescapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.innerHTML = str;
  return div.textContent;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function togglePassword() {
  const pw = document.getElementById('login-password');
  const btn = document.getElementById('pw-toggle-btn');
  if (pw.type === 'password') {
    pw.type = 'text';
    btn.innerHTML = '&#128064;';
    btn.title = 'Hide password';
  } else {
    pw.type = 'password';
    btn.innerHTML = '&#128065;';
    btn.title = 'Show password';
  }
}

function toggleUserPassword() {
  const pw = document.getElementById('user-password');
  const btn = document.getElementById('user-pw-toggle-btn');
  if (pw.type === 'password') {
    pw.type = 'text';
    btn.innerHTML = '&#128064;';
    btn.title = 'Hide password';
  } else {
    pw.type = 'password';
    btn.innerHTML = '&#128065;';
    btn.title = 'Show password';
  }
}

function toggleProfilePassword(type) {
  const ids = {
    current: 'profile-current-password',
    new: 'profile-new-password',
    confirm: 'profile-confirm-password'
  };
  const btnIds = {
    current: 'profile-current-pw-toggle-btn',
    new: 'profile-new-pw-toggle-btn',
    confirm: 'profile-confirm-pw-toggle-btn'
  };
  const pw = document.getElementById(ids[type]);
  const btn = document.getElementById(btnIds[type]);
  if (pw.type === 'password') {
    pw.type = 'text';
    btn.innerHTML = '&#128064;';
    btn.title = 'Hide password';
  } else {
    pw.type = 'password';
    btn.innerHTML = '&#128065;';
    btn.title = 'Show password';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDetail();
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    handleLogin();
  }
});

(function init() {
  const savedToken = localStorage.getItem('srp_token');
  const savedUser = localStorage.getItem('srp_user');
  if (savedToken && savedUser) {
    authToken = savedToken;
    try { 
      currentUser = JSON.parse(savedUser);
      showApp();
    } catch { currentUser = null; }
    
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${savedToken}` } })
      .then(async res => {
        if (!res.ok) {
          localStorage.removeItem('srp_token');
          localStorage.removeItem('srp_user');
          location.reload();
          return null;
        }

        const data = await res.json().catch(() => null);
        if (data?.success && data.user) {
          mergeUserFromApi({
            id: data.user.id,
            username: data.user.username,
            role: data.user.role,
            fullName: data.user.full_name,
            avatar: data.user.avatar,
            created_at: data.user.created_at,
          });
          persistCurrentUser();
          applyHeaderUser();
          loadDashboard();
        }

        return null;
      })
      .catch(() => {});
  }
})();
