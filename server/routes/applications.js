/**
 * Applications Routes - Application Tracking Pipeline, Status Updates, CSV Export
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');

router.get('/', authenticate, (req, res) => {
  const { status, portal, limit = 50, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM applications WHERE user_id = ?';
  const params = [req.user.userId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (portal) {
    query += ' AND portal = ?';
    params.push(portal);
  }

  query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const applications = db.prepare(query).all(...params);

  applications.forEach(app => {
    try {
      app.answers = JSON.parse(app.answers || '{}');
    } catch (e) {
      app.answers = {};
    }
  });

  const total = db.prepare('SELECT COUNT(*) as total FROM applications WHERE user_id = ?').get(req.user.userId).total;

  res.json({ applications, total, page: parseInt(page), limit: parseInt(limit) });
});

router.put('/:id/status', authenticate, (req, res) => {
  const { status, execution_log, verified } = req.body;
  const allowedStatuses = [
    'Discovered', 'Matched', 'Saved', 'Ready to apply',
    'Application prepared', 'Submitted', 'Submission uncertain',
    'Failed', 'Rejected', 'Interview', 'Offer', 'Withdrawn'
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid application status.' });
  }

  db.prepare(`
    UPDATE applications
    SET status = ?, execution_log = COALESCE(?, execution_log), verified = COALESCE(?, verified), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(status, execution_log || null, verified !== undefined ? (verified ? 1 : 0) : null, req.params.id, req.user.userId);

  res.json({ message: 'Application status updated.' });
});

module.exports = router;
