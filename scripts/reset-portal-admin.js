const crypto = require('crypto');

const {
  initDatabase,
  dbGet,
  dbRun,
  saveDbNow,
} = require('../mini-services/recruitment-portal/src/config/database');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  await initDatabase();

  const username = 'admin';
  const fullName = process.env.PORTAL_ADMIN_FULL_NAME || 'Shahrukh';
  const passwordHash = hashPassword('admin');
  const existingUser = dbGet('SELECT id FROM users WHERE username = ?', [username]);
  const existingAdminRole = dbGet("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  const nextIdRow = dbGet('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM users');

  if (existingUser) {
    dbRun(
      "UPDATE users SET password_hash = ?, role = 'admin', full_name = ?, avatar = NULL, updated_at = datetime('now') WHERE username = ?",
      [passwordHash, fullName, username]
    );
  } else if (existingAdminRole) {
    dbRun(
      "UPDATE users SET username = ?, password_hash = ?, role = 'admin', full_name = ?, avatar = NULL, updated_at = datetime('now') WHERE id = ?",
      [username, passwordHash, fullName, existingAdminRole.id]
    );
  } else {
    dbRun(
      `INSERT INTO users (id, username, password_hash, api_key, role, full_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nextIdRow?.nextId || 1, username, passwordHash, 'manual-admin-reset', 'admin', fullName]
    );
  }

  saveDbNow();

  const user = dbGet('SELECT id, username, role, full_name FROM users WHERE username = ?', [username]);
  console.log(JSON.stringify(user));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});