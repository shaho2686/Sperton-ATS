const fs = require('fs');
const path = require('path');

const RESUME_DIR = path.join(__dirname, '..', '..', 'data', 'resumes');

function ensureResumeDir() {
  if (!fs.existsSync(RESUME_DIR)) {
    fs.mkdirSync(RESUME_DIR, { recursive: true });
  }
}

function sanitizeExtension(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (!ext) return '.bin';
  const cleanExt = ext.replace(/[^.a-z0-9]/g, '');
  return cleanExt || '.bin';
}

function extractBase64Payload(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const commaIndex = trimmed.indexOf(',');
  return commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

function deleteStoredResume(candidateId) {
  if (!candidateId) return;
  ensureResumeDir();
  const prefix = `${candidateId}.`;
  for (const entry of fs.readdirSync(RESUME_DIR)) {
    if (entry === candidateId || entry.startsWith(prefix)) {
      fs.rmSync(path.join(RESUME_DIR, entry), { force: true });
    }
  }
}

function storeResumeFile(candidateId, filename, base64Data) {
  const payload = extractBase64Payload(base64Data);
  if (!candidateId || !filename || !payload) return null;

  ensureResumeDir();
  deleteStoredResume(candidateId);

  const filePath = path.join(RESUME_DIR, `${candidateId}${sanitizeExtension(filename)}`);
  fs.writeFileSync(filePath, Buffer.from(payload, 'base64'));
  return filePath;
}

function findStoredResume(candidateId) {
  if (!candidateId) return null;
  ensureResumeDir();
  const prefix = `${candidateId}.`;
  const match = fs.readdirSync(RESUME_DIR).find(entry => entry === candidateId || entry.startsWith(prefix));
  return match ? path.join(RESUME_DIR, match) : null;
}

function hasStoredResume(candidateId) {
  return Boolean(findStoredResume(candidateId));
}

function readStoredResume(candidateId) {
  const filePath = findStoredResume(candidateId);
  if (!filePath) return null;

  return {
    filePath,
    buffer: fs.readFileSync(filePath)
  };
}

module.exports = {
  hasStoredResume,
  readStoredResume,
  storeResumeFile
};