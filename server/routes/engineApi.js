/**
 * Engine API Routes - Endpoint Bridge for Local Windows Automation Engine
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/database');
const authService = require('../services/authService');
const { calculateJobMatch } = require('../services/jobMatcherService');

// Middleware for Engine API Key Authentication
function authenticateEngine(req, res, next) {
  const apiKey = req.headers['x-engine-api-key'] || req.query.apiKey;
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing Engine API Key' });
  }

  const user = authService.getUserByApiKey(apiKey);
  if (!user) {
    return res.status(401).json({ error: 'Invalid Engine API Key' });
  }

  req.user = user;
  next();
}

// Get user preferences and configuration for automation execution
router.get('/sync-config', authenticateEngine, (req, res) => {
  const userId = req.user.id;

  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || {};
  let prefs = db.prepare('SELECT * FROM job_preferences WHERE user_id = ?').get(userId) || {};
  let settings = db.prepare('SELECT * FROM automation_settings WHERE user_id = ?').get(userId) || {};
  const primaryResume = db.prepare('SELECT * FROM resumes WHERE user_id = ? AND is_primary = 1').get(userId) || {};

  // Parse JSON columns
  ['roles', 'job_types', 'locations', 'excluded_locations', 'excluded_companies', 'excluded_keywords'].forEach(col => {
    try {
      prefs[col] = JSON.parse(prefs[col] || '[]');
    } catch (e) {
      prefs[col] = [];
    }
  });

  try {
    settings.enabled_portals = JSON.parse(settings.enabled_portals || '[]');
  } catch (e) {
    settings.enabled_portals = ['naukri', 'wellfound', 'indeed'];
  }

  try {
    profile.highlights = JSON.parse(profile.highlights || '[]');
  } catch (e) {
    profile.highlights = [];
  }

  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email },
    profile,
    preferences: prefs,
    automationSettings: settings,
    resume: primaryResume,
    geminiKey: process.env.GEMINI_KEY || ''
  });
});

// Report a discovered job from local engine Playwright run
router.post('/report-job', authenticateEngine, (req, res) => {
  const userId = req.user.id;
  const { portal, original_url, job_identifier, title, company, location, remote_type, salary, experience_req, job_type, posting_date, description } = req.body;

  if (!portal || !original_url || !title) {
    return res.status(400).json({ error: 'Portal, original_url, and title are required.' });
  }

  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || {};
  let prefs = db.prepare('SELECT * FROM job_preferences WHERE user_id = ?').get(userId) || {};
  ['roles', 'job_types', 'locations', 'excluded_companies', 'excluded_keywords'].forEach(col => {
    try {
      prefs[col] = JSON.parse(prefs[col] || '[]');
    } catch (e) {
      prefs[col] = [];
    }
  });

  const jobObj = { portal, original_url, job_identifier: job_identifier || original_url, title, company, location, remote_type, salary, experience_req, job_type, description };
  const matchResult = calculateJobMatch(jobObj, profile, prefs);

  const jobId = crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO discovered_jobs (
        id, user_id, portal, original_url, job_identifier, title, company, location,
        remote_type, salary, experience_req, job_type, posting_date, description,
        match_score, match_explanation, missing_skills, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, portal, job_identifier) DO UPDATE SET
        title = excluded.title,
        salary = excluded.salary,
        match_score = excluded.match_score,
        match_explanation = excluded.match_explanation
    `).run(
      jobId, userId, portal, original_url, job_identifier || original_url, title, company || '', location || '',
      remote_type || 'Onsite', salary || '', experience_req || '', job_type || '', posting_date || '', description || '',
      matchResult.matchScore, matchResult.explanation, JSON.stringify(matchResult.missingSkills),
      matchResult.isEligible ? 'Matched' : 'Discovered'
    );

    res.json({ status: 'success', jobId, matchScore: matchResult.matchScore, classification: matchResult.classification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Report an application attempt or successful submission from local engine
router.post('/report-application', authenticateEngine, (req, res) => {
  const userId = req.user.id;
  const { portal, title, company, job_url, status, answers, execution_log, verified } = req.body;

  const appId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO applications (
      id, user_id, portal, title, company, job_url, status, answers, execution_log, verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    appId, userId, portal, title, company || '', job_url || '', status || 'Submitted',
    JSON.stringify(answers || {}), execution_log || '', verified ? 1 : 0
  );

  db.prepare('INSERT INTO automation_logs (user_id, portal, level, message) VALUES (?, ?, "INFO", ?)').run(
    userId, portal, `Application ${status}: ${title} at ${company || 'Company'}`
  );

  res.json({ status: 'recorded', appId });
});

// Heartbeat ping from local Windows Automation Engine
router.post('/ping', authenticateEngine, (req, res) => {
  const userId = req.user.id;
  const { systemInfo } = req.body;

  db.prepare(`
    INSERT INTO engine_sessions (user_id, connection_status, last_ping, system_info)
    VALUES (?, 'Online', CURRENT_TIMESTAMP, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      connection_status = 'Online',
      last_ping = CURRENT_TIMESTAMP,
      system_info = excluded.system_info
  `).run(userId, JSON.stringify(systemInfo || {}));

  res.json({ status: 'pong', serverTime: new Date().toISOString() });
});

module.exports = { router, authenticateEngine };
