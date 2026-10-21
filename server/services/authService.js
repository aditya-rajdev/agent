/**
 * Auth Service - User Registration, Login, Token Management, Password Hashing.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'ai-job-agent-secret-key-2026';

function registerUser({ email, password, name, phone }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    throw new Error('User with this email already exists.');
  }

  const userId = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const engineApiKey = 'engine_ak_' + crypto.randomBytes(16).toString('hex');

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, phone, engine_api_key)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertProfile = db.prepare(`
    INSERT INTO profiles (user_id, current_role, company, education, years_experience, skills, highlights, notice_period, current_ctc, expected_ctc, location)
    VALUES (?, 'Software Engineer', '', 'Bachelor of Technology', '1 year', 'JavaScript, TypeScript, React, Node.js', '["Built scalable web applications", "Integrated REST APIs"]', '30 days', '6', '12', 'Bengaluru, India')
  `);

  const insertPreferences = db.prepare(`
    INSERT INTO job_preferences (user_id, roles, job_types, locations)
    VALUES (?, '["Full Stack Developer", "Software Engineer", "Backend Developer"]', '["Full-time", "Remote", "Internship"]', '["Remote", "India", "Bengaluru"]')
  `);

  const insertAutomation = db.prepare(`
    INSERT INTO automation_settings (user_id, enabled, dry_run, enabled_portals)
    VALUES (?, 1, 1, '["naukri", "wellfound", "indeed"]')
  `);

  const transaction = db.transaction(() => {
    insertUser.run(userId, email.toLowerCase(), passwordHash, name, phone || '', engineApiKey);
    insertProfile.run(userId);
    insertPreferences.run(userId);
    insertAutomation.run(userId);
  });

  transaction();

  const token = jwt.sign({ userId, email: email.toLowerCase(), name }, JWT_SECRET, { expiresIn: '7d' });
  return { userId, email: email.toLowerCase(), name, token, engineApiKey };
}

function loginUser({ email, password }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid email or password.');
  }

  const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  return { userId: user.id, email: user.email, name: user.name, phone: user.phone, engineApiKey: user.engine_api_key, token };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function getUserByApiKey(apiKey) {
  return db.prepare('SELECT id, email, name FROM users WHERE engine_api_key = ?').get(apiKey);
}

module.exports = {
  registerUser,
  loginUser,
  verifyToken,
  getUserByApiKey,
  JWT_SECRET
};
