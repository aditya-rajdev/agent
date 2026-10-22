/**
 * Engine API Routes - Endpoint Bridge for Local Windows Automation Engine
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db/database');
const authService = require('../services/authService');
const { calculateJobMatch } = require('../services/jobMatcherService');
const { evaluateVerification, CREDIBLE_CONFIRMATION_PATTERNS } = require('../services/verificationService');

// Middleware for Engine API Key Authentication (Header authentication only)
function authenticateEngine(req, res, next) {
  const apiKey = req.headers['x-engine-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing Engine API Key header (X-Engine-API-Key required).' });
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
    settings.enabled_portals = ['naukri', 'wellfound', 'indeed', 'linkedin', 'upstox', 'unstop', 'internshala'];
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

// Helper to resolve company name without fabricating names or cross-portal leakage
function resolveCompanyName(userId, portal, jobUrl, providedCompany) {
  let company = (providedCompany || '').trim();
  if (company && company !== 'N/A' && company !== 'Unknown company') {
    return company;
  }

  // Look up discovered_jobs by user_id, portal, and job_url
  if (jobUrl && jobUrl.trim() !== '') {
    const discovered = db.prepare('SELECT company FROM discovered_jobs WHERE user_id = ? AND portal = ? AND (original_url = ? OR job_identifier = ?)').get(userId, portal, jobUrl.trim(), jobUrl.trim());
    if (discovered && discovered.company && discovered.company.trim() !== '' && discovered.company !== 'N/A') {
      return discovered.company.trim();
    }
  }

  return company || 'Unknown company';
}

// Report a discovered job from local engine Playwright run
router.post('/report-job', authenticateEngine, (req, res) => {
  const userId = req.user.id;
  const { portal, original_url, job_identifier, title, company, location, remote_type, salary, experience_req, job_type, posting_date, description } = req.body;

  if (!portal || !original_url || !title) {
    return res.status(400).json({ error: 'Portal, original_url, and title are required.' });
  }

  const resolvedCompany = resolveCompanyName(userId, portal, original_url, company);

  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || {};
  let prefs = db.prepare('SELECT * FROM job_preferences WHERE user_id = ?').get(userId) || {};
  ['roles', 'job_types', 'locations', 'excluded_companies', 'excluded_keywords'].forEach(col => {
    try {
      prefs[col] = JSON.parse(prefs[col] || '[]');
    } catch (e) {
      prefs[col] = [];
    }
  });

  const jobObj = { portal, original_url, job_identifier: job_identifier || original_url, title, company: resolvedCompany, location, remote_type, salary, experience_req, job_type, description };
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
        company = CASE WHEN excluded.company != '' AND excluded.company != 'Unknown company' THEN excluded.company ELSE discovered_jobs.company END,
        salary = excluded.salary,
        match_score = excluded.match_score,
        match_explanation = excluded.match_explanation
    `).run(
      jobId, userId, portal, original_url, job_identifier || original_url, title, resolvedCompany, location || '',
      remote_type || 'Onsite', salary || '', experience_req || '', job_type || '', posting_date || '', description || '',
      matchResult.matchScore, matchResult.explanation, JSON.stringify(matchResult.missingSkills),
      matchResult.isEligible ? 'Matched' : 'Discovered'
    );

    res.json({ status: 'success', jobId, matchScore: matchResult.matchScore, classification: matchResult.classification });
  } catch (err) {
    res.status(500).json({ error: 'Database operation failed.' });
  }
});

// Report an application attempt or successful submission from local engine
router.post('/report-application', authenticateEngine, (req, res) => {
  const userId = req.user.id;
  let { portal, title, company, job_url, status, answers, execution_log, verification_evidence } = req.body;

  if (!portal || !title) {
    return res.status(400).json({ error: 'Portal and title are required.' });
  }

  const normalizedCompany = resolveCompanyName(userId, portal, job_url, company);
  const normalizedUrl = (job_url || '').trim();
  const evidenceText = (verification_evidence || execution_log || '').trim();

  // Evaluate via Centralized Verification Service
  const evalResult = evaluateVerification(status, evidenceText);
  const finalStatus = evalResult.finalStatus;
  const isVerified = evalResult.verified;

  const appId = crypto.randomUUID();

  try {
    db.prepare(`
      INSERT INTO applications (
        id, user_id, portal, title, company, job_url, status, answers,
        execution_log, verification_evidence, attempt_count, verified,
        created_at, prepared_at, attempted_at, submitted_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 1, ?,
        CURRENT_TIMESTAMP,
        CASE WHEN ? = 'Application prepared' THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN ? = 'Submission uncertain' OR ? = 'Submitted' THEN CURRENT_TIMESTAMP ELSE NULL END,
        CASE WHEN ? = 'Submitted' THEN CURRENT_TIMESTAMP ELSE NULL END
      )
      ON CONFLICT(user_id, portal, job_url) DO UPDATE SET
        status = excluded.status,
        company = CASE WHEN excluded.company != '' AND excluded.company != 'Unknown company' THEN excluded.company ELSE applications.company END,
        answers = excluded.answers,
        execution_log = excluded.execution_log,
        verification_evidence = excluded.verification_evidence,
        attempt_count = applications.attempt_count + 1,
        verified = excluded.verified,
        prepared_at = CASE WHEN excluded.status = 'Application prepared' THEN COALESCE(applications.prepared_at, CURRENT_TIMESTAMP) ELSE applications.prepared_at END,
        attempted_at = CASE WHEN excluded.status = 'Submission uncertain' OR excluded.status = 'Submitted' THEN COALESCE(applications.attempted_at, CURRENT_TIMESTAMP) ELSE applications.attempted_at END,
        submitted_at = CASE WHEN excluded.status = 'Submitted' THEN COALESCE(applications.submitted_at, CURRENT_TIMESTAMP) ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      appId, userId, portal, title, normalizedCompany, normalizedUrl, finalStatus,
      JSON.stringify(answers || {}), execution_log || '', evidenceText, isVerified,
      finalStatus, finalStatus, finalStatus, finalStatus
    );

    db.prepare('INSERT INTO automation_logs (user_id, portal, level, message) VALUES (?, ?, "INFO", ?)').run(
      userId, portal, `Application [${finalStatus}]: "${title}" at "${normalizedCompany || 'Company'}"`
    );

    res.json({ status: 'recorded', appId, finalStatus, verified: isVerified, explanation: evalResult.explanation });
  } catch (err) {
    res.status(500).json({ error: 'Database operation failed.' });
  }
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

module.exports = { router, authenticateEngine, CREDIBLE_CONFIRMATION_PATTERNS };
