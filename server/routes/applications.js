/**
 * Applications Routes - Application Tracking Pipeline, Status Updates, Reconciliation
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');
const { evaluateVerification, CREDIBLE_CONFIRMATION_PATTERNS } = require('../services/verificationService');

router.get('/', authenticate, (req, res) => {
  const { status, portal, limit = 50, page = 1 } = req.query;
  const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
  const pageNum = Math.max(parseInt(page) || 1, 1);
  const offset = (pageNum - 1) * limitNum;

  let query = 'SELECT * FROM applications WHERE user_id = ?';
  let countQuery = 'SELECT COUNT(*) as total FROM applications WHERE user_id = ?';
  const params = [req.user.userId];
  const countParams = [req.user.userId];

  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (portal) {
    query += ' AND portal = ?';
    countQuery += ' AND portal = ?';
    params.push(portal);
    countParams.push(portal);
  }

  query += ' ORDER BY COALESCE(submitted_at, prepared_at, created_at) DESC LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const applications = db.prepare(query).all(...params);

  applications.forEach(app => {
    try {
      app.answers = JSON.parse(app.answers || '{}');
    } catch (e) {
      app.answers = {};
    }
  });

  const total = db.prepare(countQuery).get(...countParams).total;
  const totalPages = Math.ceil(total / limitNum) || 1;

  res.json({ applications, total, totalPages, page: pageNum, limit: limitNum });
});

router.put('/:id/status', authenticate, (req, res) => {
  const { status, execution_log, verification_evidence } = req.body;
  const allowedStatuses = [
    'Discovered', 'Matched', 'Saved', 'Ready to apply',
    'Application prepared', 'Submitted', 'Submission uncertain',
    'Failed', 'Rejected', 'Interview', 'Offer', 'Withdrawn'
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid application status.' });
  }

  const evidence = (verification_evidence || execution_log || '').trim();
  const evalResult = evaluateVerification(status, evidence);
  const finalStatus = evalResult.finalStatus;
  const finalVerified = evalResult.verified;

  const result = db.prepare(`
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

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Application record not found or unauthorized.' });
  }

  res.json({ message: 'Application status updated.', status: finalStatus, verified: finalVerified, explanation: evalResult.explanation });
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
    const evalResult = evaluateVerification(app.status, evidence);
    const newStatus = evalResult.finalStatus;
    const newVerified = evalResult.verified;

    // Resolve company name without cross-portal ambiguity
    let resolvedCompany = app.company;
    if (!resolvedCompany || resolvedCompany === '' || resolvedCompany === 'N/A') {
      const job = db.prepare('SELECT company FROM discovered_jobs WHERE user_id = ? AND portal = ? AND (original_url = ? OR job_identifier = ?)').get(userId, app.portal, app.job_url || '', app.job_url || '');
      if (job && job.company && job.company !== 'N/A') {
        resolvedCompany = job.company;
      } else {
        resolvedCompany = 'Unknown company';
      }
    }

    if (newStatus !== app.status || newVerified !== app.verified || resolvedCompany !== app.company) {
      updateStmt.run(newStatus, newVerified, resolvedCompany || 'Unknown company', newStatus, app.id, userId);
      reconciledCount++;
    }
  });

  res.json({ message: `Reconciled ${reconciledCount} application records based on credible evidence.`, reconciledCount });
});

module.exports = router;
