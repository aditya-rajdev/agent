/**
 * Database Layer - Persistent SQLite engine using better-sqlite3.
 * Supports multi-user isolation, foreign keys, structured JSON fields, and indexes.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/app.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      engine_api_key TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      location TEXT DEFAULT '',
      dob TEXT DEFAULT '',
      gender TEXT DEFAULT 'Prefer not to say',
      education TEXT DEFAULT '',
      graduation_year TEXT DEFAULT '',
      years_experience TEXT DEFAULT '0',
      skills TEXT DEFAULT '',
      current_role TEXT DEFAULT '',
      company TEXT DEFAULT '',
      current_ctc TEXT DEFAULT '0',
      expected_ctc TEXT DEFAULT '0',
      notice_period TEXT DEFAULT '30 days',
      start_date TEXT DEFAULT '',
      work_auth TEXT DEFAULT 'Authorized to work',
      sponsorship_req TEXT DEFAULT 'No',
      relocate_pref TEXT DEFAULT 'Yes, open to relocation',
      remote_pref TEXT DEFAULT 'Yes, open to remote',
      github_url TEXT DEFAULT '',
      linkedin_url TEXT DEFAULT '',
      portfolio_url TEXT DEFAULT '',
      highlights TEXT DEFAULT '[]',
      cover_letter_template TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      parsed_text TEXT DEFAULT '',
      extracted_data TEXT DEFAULT '{}',
      is_primary INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      roles TEXT DEFAULT '["Full Stack Developer", "Software Engineer"]',
      job_types TEXT DEFAULT '["Full-time", "Remote"]',
      locations TEXT DEFAULT '["Remote", "India"]',
      excluded_locations TEXT DEFAULT '[]',
      min_salary REAL DEFAULT 0,
      max_salary REAL DEFAULT 0,
      experience_level TEXT DEFAULT 'Entry-level',
      graduation_year TEXT DEFAULT '',
      company_preferences TEXT DEFAULT '',
      excluded_companies TEXT DEFAULT '[]',
      excluded_keywords TEXT DEFAULT '["Senior", "Manager", "Lead"]',
      max_applications_per_day INTEGER DEFAULT 30,
      min_match_score INTEGER DEFAULT 60,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled INTEGER DEFAULT 1,
      dry_run INTEGER DEFAULT 1,
      daily_schedule_time TEXT DEFAULT '09:00',
      max_daily_applications INTEGER DEFAULT 30,
      max_searches INTEGER DEFAULT 10,
      enabled_portals TEXT DEFAULT '["naukri", "wellfound", "indeed"]',
      auto_submit_enabled INTEGER DEFAULT 0,
      duplicate_prevention INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS discovered_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      portal TEXT NOT NULL,
      original_url TEXT NOT NULL,
      job_identifier TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT DEFAULT '',
      location TEXT DEFAULT '',
      remote_type TEXT DEFAULT 'Onsite',
      salary TEXT DEFAULT '',
      experience_req TEXT DEFAULT '',
      job_type TEXT DEFAULT '',
      posting_date TEXT DEFAULT '',
      description TEXT DEFAULT '',
      match_score INTEGER DEFAULT 0,
      match_explanation TEXT DEFAULT '',
      missing_skills TEXT DEFAULT '[]',
      status TEXT DEFAULT 'Discovered',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, portal, job_identifier)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id TEXT REFERENCES discovered_jobs(id) ON DELETE SET NULL,
      portal TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT DEFAULT '',
      job_url TEXT DEFAULT '',
      resume_id TEXT,
      status TEXT DEFAULT 'Ready to apply',
      answers TEXT DEFAULT '{}',
      execution_log TEXT DEFAULT '',
      verification_evidence TEXT DEFAULT '',
      attempt_count INTEGER DEFAULT 1,
      verified INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      prepared_at DATETIME,
      attempted_at DATETIME,
      submitted_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS automation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      portal TEXT DEFAULT 'System',
      level TEXT DEFAULT 'INFO',
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS engine_sessions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      connection_status TEXT DEFAULT 'Offline',
      last_ping DATETIME,
      system_info TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON discovered_jobs(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_apps_user_status ON applications(user_id, status);
    DROP INDEX IF EXISTS idx_apps_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_unique_url ON applications(user_id, portal, job_url) WHERE job_url != '';
    CREATE INDEX IF NOT EXISTS idx_logs_user_date ON automation_logs(user_id, created_at);
  `);

  // Perform safe backward-compatible migration for new columns if DB already exists
  try {
    const appColumns = db.prepare("PRAGMA table_info(applications)").all().map(c => c.name);
    const newAppCols = [
      ['verification_evidence', "TEXT DEFAULT ''"],
      ['attempt_count', "INTEGER DEFAULT 1"],
      ['created_at', "DATETIME"],
      ['prepared_at', "DATETIME"],
      ['attempted_at', "DATETIME"]
    ];
    newAppCols.forEach(([colName, colDef]) => {
      if (!appColumns.includes(colName)) {
        db.exec(`ALTER TABLE applications ADD COLUMN ${colName} ${colDef}`);
      }
    });

    // Migrate existing rows: ensure created_at is populated and submitted_at is NULL for unconfirmed applications
    db.exec(`
      UPDATE applications SET created_at = COALESCE(created_at, submitted_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL;
      UPDATE applications SET prepared_at = COALESCE(prepared_at, submitted_at, CURRENT_TIMESTAMP) WHERE prepared_at IS NULL AND (status = 'Application prepared' OR status = 'Ready to apply');
      UPDATE applications SET submitted_at = NULL WHERE status != 'Submitted';
    `);
  } catch (e) {
    console.warn('Applications table migration warning:', e.message);
  }
}

initSchema();

module.exports = db;
