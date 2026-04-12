/**
 * Sperton Recruitment Portal — Database Module (sql.js)
 *
 * Uses sql.js (pure JavaScript SQLite) — no native compilation needed.
 * Provides helper functions that mimic better-sqlite3 API for easy migration.
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'recruitment.db');
const DATA_DIR = path.dirname(DB_PATH);

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let _db = null;
let saveTimeout = null;

/**
 * Initialize the database. Returns a promise.
 * Loads from file if exists, otherwise creates in-memory and seeds tables.
 */
async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    console.log('Database loaded from:', DB_PATH);
  } else {
    _db = new SQL.Database();
    console.log('New in-memory database created.');
  }

  // Create tables if they don't exist
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'recruiter',
      full_name TEXT,
      avatar TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      current_title TEXT,
      current_company TEXT,
      location TEXT,
      linkedin_url TEXT,
      skills TEXT DEFAULT '[]',
      experience_years REAL,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK(status IN ('new', 'screening', 'interview', 'technical', 'offer', 'rejected', 'hired', 'on_hold')),
      source TEXT DEFAULT 'manual',
      notes TEXT DEFAULT '',
      resume_text TEXT,
      job_description TEXT,
      technical_score INTEGER DEFAULT 0
        CHECK(technical_score >= 0 AND technical_score <= 10),
      experience_score INTEGER DEFAULT 0
        CHECK(experience_score >= 0 AND experience_score <= 10),
      culture_fit_score INTEGER DEFAULT 0
        CHECK(culture_fit_score >= 0 AND culture_fit_score <= 10),
      overall_score INTEGER DEFAULT 0
        CHECK(overall_score >= 0 AND overall_score <= 10),
      strengths TEXT DEFAULT '[]',
      concerns TEXT DEFAULT '[]',
      ai_analysis TEXT,
      resume_file_name TEXT,
      resume_file_data TEXT,
      assigned_recruiter TEXT,
      position TEXT,
      market TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      query TEXT,
      filters TEXT DEFAULT '{}',
      results_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
    CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(full_name);
    CREATE INDEX IF NOT EXISTS idx_candidates_score ON candidates(overall_score DESC);
    CREATE INDEX IF NOT EXISTS idx_candidates_position ON candidates(position);
    CREATE INDEX IF NOT EXISTS idx_candidates_market ON candidates(market);
    CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
  `);

  const pragmaRes = _db.exec("PRAGMA table_info(candidates);");
  const candidateColumns = pragmaRes.length ? pragmaRes[0].values.map(row => row[1]) : [];
  if (!candidateColumns.includes('rejection_reason')) {
    _db.exec('ALTER TABLE candidates ADD COLUMN rejection_reason TEXT');
  }
  if (!candidateColumns.includes('resume_file_name')) {
    _db.exec('ALTER TABLE candidates ADD COLUMN resume_file_name TEXT');
  }
  if (!candidateColumns.includes('resume_file_data')) {
    _db.exec('ALTER TABLE candidates ADD COLUMN resume_file_data TEXT');
  }

  const pragmaUserRes = _db.exec("PRAGMA table_info(users);");
  const userColumns = pragmaUserRes.length ? pragmaUserRes[0].values.map(row => row[1]) : [];
  if (!userColumns.includes('avatar')) {
    _db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
  }

  saveDbNow();
  console.log('Database initialized successfully.');
  return _db;
}

function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

// ── Save to file ──────────────────────────────────────────────────────────────

function saveDbNow() {
  if (!_db) return;
  try {
    const data = _db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('Failed to save database:', e.message);
  }
}

function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDbNow, 300);
}

// ── Helper: normalize params ──────────────────────────────────────────────────

function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params;
  return [params];
}

// ── dbGet: execute a query and return the first row as an object ──────────────

function dbGet(sql, ...rest) {
  const db = getDb();
  const params = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
  const stmt = db.prepare(sql);
  stmt.bind(normalizeParams(params));
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

// ── dbAll: execute a query and return all rows as an array of objects ─────────

function dbAll(sql, ...rest) {
  const db = getDb();
  const params = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
  const stmt = db.prepare(sql);
  stmt.bind(normalizeParams(params));
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ── dbRun: execute a statement (INSERT, UPDATE, DELETE) ───────────────────────

function dbRun(sql, ...rest) {
  const db = getDb();
  const params = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
  db.run(sql, normalizeParams(params));
  debouncedSave();
}

// ── dbExec: execute raw SQL (DDL, multi-statement) ───────────────────────────

function dbExec(sql) {
  const db = getDb();
  db.exec(sql);
}

// ── dbBegin / dbCommit for transactions ───────────────────────────────────────

function dbBegin() { getDb().run('BEGIN TRANSACTION'); }
function dbCommit() { getDb().run('COMMIT'); debouncedSave(); }
function dbRollback() { getDb().run('ROLLBACK'); }

module.exports = {
  initDatabase,
  getDb,
  dbGet,
  dbAll,
  dbRun,
  dbExec,
  dbBegin,
  dbCommit,
  dbRollback,
  saveDbNow
};
