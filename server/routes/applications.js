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

  query += ' ORDER BY COALESCE(submitted_at, prepared_at, created_at) DESC LIMIT ? OFFSET ?';
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

  const evidence = (verification_evidence || execution_log || '').trim();
  let finalVerified = 0;
  let finalStatus = status;

  if (finalStatus === 'Submitted') {
    if (evidence && CREDIBLE_CONFIRMATION_PATTERNS.test(evidence)) {
      finalVerified = 1;
    } else {
      finalStatus = 'Submission uncertain';
      finalVerified = 0;
    }
  } else {
    finalVerified = 0;
  }

  db.prepare(`
    UPDATE applications
    SET status = ?,
        execution_log = COALESCE(?, execution_log),
        verification_evidence = COALESCE(?, verification_evidence),
        verified = ?,
        submitted_at = CASE WHEN ? = 'Submitted' THEN COALESCE(submitted_at, CURRENT_TIMESTAMP) ELSE NULL END,
        prepared_at = CASE WHEN ? = 'Application prepared' THEN COALESCE(prepared_at, CURRENT_TIMESTAMP) ELSE prepared_at END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(finalStatus, execution_log || null, verification_evidence || null, finalVerified, finalStatus, finalStatus, req.params.id, req.user.userId);

  res.json({ message: 'Application status updated.', status: finalStatus, verified: finalVerified });
});

// Safe Reconciliation Endpoint - Reconciles Application Pipeline Statuses Based Strictly on Evidence
router.post('/reconcile', authenticate, (req, res) => {
  const userId = req.user.userId;
  const applications = db.prepare('SELECT * FROM applications WHERE user_id = ?').all(userId);

  let reconciledCount = 0;

  const updateStmt = db.prepare(`
    UPDATE applications
    SET status = ?,
        verified = ?,
        company = CASE WHEN company = '' OR company = 'N/A' THEN ? ELSE company END,
        submitted_at = CASE WHEN ? = 'Submitted' THEN COALESCE(submitted_at, CURRENT_TIMESTAMP) ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `);

  applications.forEach(app => {
    const evidence = (app.verification_evidence || app.execution_log || '').trim();
    let newStatus = app.status;
    let newVerified = 0;

    // Resolve company name if empty or N/A
    let resolvedCompany = app.company;
    if (!resolvedCompany || resolvedCompany === '' || resolvedCompany === 'N/A') {
      const job = db.prepare('SELECT company FROM discovered_jobs WHERE user_id = ? AND (original_url = ? OR job_identifier = ?)').get(userId, app.job_url || '', app.job_url || '');
      if (job && job.company && job.company !== 'N/A') {
        resolvedCompany = job.company;
      } else {
        resolvedCompany = 'Unknown company';
      }
    }

    if (app.status === 'Submitted') {
      if (CREDIBLE_CONFIRMATION_PATTERNS.test(evidence)) {
        newStatus = 'Submitted';
        newVerified = 1;
      } else {
        newStatus = 'Submission uncertain';
        newVerified = 0;
      }
    } else if (/dry run|would click|form filled/i.test(evidence) || app.status === 'Application prepared') {
      newStatus = 'Application prepared';
      newVerified = 0;
    } else {
      newVerified = 0;
    }

    if (newStatus !== app.status || newVerified !== app.verified || resolvedCompany !== app.company) {
      updateStmt.run(newStatus, newVerified, resolvedCompany || 'Unknown company', newStatus, app.id, userId);
      reconciledCount++;
    }
  });

  res.json({ message: `Reconciled ${reconciledCount} application records based on credible evidence.`, reconciledCount });
});

module.exports = router;
