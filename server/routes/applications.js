/**
 * Applications Routes - Application Tracking Pipeline, Status Updates, Reconciliation
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');
const { CREDIBLE_CONFIRMATION_PATTERNS } = require('./engineApi');

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
  const { status, execution_log, verification_evidence, verified } = req.body;
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
    SET status = ?,
        execution_log = COALESCE(?, execution_log),
        verification_evidence = COALESCE(?, verification_evidence),
        verified = COALESCE(?, verified),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(status, execution_log || null, verification_evidence || null, verified !== undefined ? (verified ? 1 : 0) : null, req.params.id, req.user.userId);

  res.json({ message: 'Application status updated.' });
});

// Safe Reconciliation Endpoint - Reconciles Application Pipeline Statuses Based Strictly on Evidence
router.post('/reconcile', authenticate, (req, res) => {
  const userId = req.user.userId;
  const applications = db.prepare('SELECT * FROM applications WHERE user_id = ?').all(userId);

  let reconciledCount = 0;

  const updateStmt = db.prepare(`
    UPDATE applications
    SET status = ?, verified = ?, company = CASE WHEN company = '' OR company = 'N/A' THEN ? ELSE company END, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);

  applications.forEach(app => {
    const evidence = (app.verification_evidence || app.execution_log || '').trim();
    let newStatus = app.status;
    let newVerified = app.verified;

    // Resolve company name if empty
    let resolvedCompany = app.company;
    if (!resolvedCompany || resolvedCompany === '' || resolvedCompany === 'N/A') {
      const job = db.prepare('SELECT company FROM discovered_jobs WHERE user_id = ? AND (original_url = ? OR job_identifier = ?)').get(userId, app.job_url || '', app.job_url || '');
      if (job && job.company && job.company !== 'N/A') {
        resolvedCompany = job.company;
      }
    }

    if (app.status === 'Submitted') {
      if (CREDIBLE_CONFIRMATION_PATTERNS.test(evidence) || app.verified === 1) {
        newStatus = 'Submitted';
        newVerified = 1;
      } else {
        newStatus = 'Submission uncertain';
        newVerified = 0;
      }
    } else if (/dry run|would click|form filled/i.test(evidence) || app.status === 'Application prepared') {
      newStatus = 'Application prepared';
      newVerified = 0;
    }

    if (newStatus !== app.status || newVerified !== app.verified || resolvedCompany !== app.company) {
      updateStmt.run(newStatus, newVerified, resolvedCompany || '', app.id, userId);
      reconciledCount++;
    }
  });

  res.json({ message: `Reconciled ${reconciledCount} application records based on credible evidence.`, reconciledCount });
});

module.exports = router;
