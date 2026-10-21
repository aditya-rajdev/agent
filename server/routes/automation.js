/**
 * Automation Routes - Controls Local Windows Engine Configuration,
 * Emergency Stop, Daily Schedules, Portal Toggles, and Execution Logs.
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');

router.get('/settings', authenticate, (req, res) => {
  let settings = db.prepare('SELECT * FROM automation_settings WHERE user_id = ?').get(req.user.userId);
  if (!settings) {
    db.prepare('INSERT INTO automation_settings (user_id) VALUES (?)').run(req.user.userId);
    settings = db.prepare('SELECT * FROM automation_settings WHERE user_id = ?').get(req.user.userId);
  }

  try {
    settings.enabled_portals = JSON.parse(settings.enabled_portals || '[]');
  } catch (e) {
    settings.enabled_portals = ['naukri', 'wellfound', 'indeed'];
  }

  const session = db.prepare('SELECT * FROM engine_sessions WHERE user_id = ?').get(req.user.userId);

  res.json({ settings, engineSession: session || { connection_status: 'Offline' } });
});

router.put('/settings', authenticate, (req, res) => {
  const { enabled, dry_run, daily_schedule_time, max_daily_applications, max_searches, enabled_portals, auto_submit_enabled, duplicate_prevention } = req.body;

  db.prepare(`
    UPDATE automation_settings SET
      enabled = ?,
      dry_run = ?,
      daily_schedule_time = ?,
      max_daily_applications = ?,
      max_searches = ?,
      enabled_portals = ?,
      auto_submit_enabled = ?,
      duplicate_prevention = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    enabled ? 1 : 0,
    dry_run ? 1 : 0,
    daily_schedule_time || '09:00',
    max_daily_applications || 30,
    max_searches || 10,
    JSON.stringify(enabled_portals || ['naukri', 'wellfound', 'indeed']),
    auto_submit_enabled ? 1 : 0,
    duplicate_prevention ? 1 : 0,
    req.user.userId
  );

  res.json({ message: 'Automation settings updated.' });
});

// GLOBAL EMERGENCY STOP
router.post('/emergency-stop', authenticate, (req, res) => {
  db.prepare('UPDATE automation_settings SET enabled = 0 WHERE user_id = ?').run(req.user.userId);
  db.prepare('INSERT INTO automation_logs (user_id, portal, level, message) VALUES (?, "System", "CRITICAL", "GLOBAL EMERGENCY STOP INITIATED BY USER")').run(req.user.userId);
  res.json({ message: 'Emergency stop activated. All automation paused.' });
});

router.get('/logs', authenticate, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = db.prepare('SELECT * FROM automation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(req.user.userId, limit);
  res.json({ logs });
});

router.post('/logs', authenticate, (req, res) => {
  const { portal, level, message } = req.body;
  db.prepare('INSERT INTO automation_logs (user_id, portal, level, message) VALUES (?, ?, ?, ?)').run(
    req.user.userId, portal || 'System', level || 'INFO', message || ''
  );
  res.json({ status: 'logged' });
});

module.exports = router;
