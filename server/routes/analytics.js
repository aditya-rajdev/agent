/**
 * Analytics Routes - Provides Summary Metrics, Application Funnel, Match Score Metrics
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');

router.get('/', authenticate, (req, res) => {
  const userId = req.user.userId;

  const totalDiscovered = db.prepare('SELECT COUNT(*) as cnt FROM discovered_jobs WHERE user_id = ?').get(userId).cnt;
  const totalMatched = db.prepare('SELECT COUNT(*) as cnt FROM discovered_jobs WHERE user_id = ? AND match_score >= 60').get(userId).cnt;
  const totalApplications = db.prepare('SELECT COUNT(*) as cnt FROM applications WHERE user_id = ?').get(userId).cnt;
  const totalSubmitted = db.prepare('SELECT COUNT(*) as cnt FROM applications WHERE user_id = ? AND status = "Submitted"').get(userId).cnt;
  const totalFailed = db.prepare('SELECT COUNT(*) as cnt FROM applications WHERE user_id = ? AND status = "Failed"').get(userId).cnt;
  const totalInterviews = db.prepare('SELECT COUNT(*) as cnt FROM applications WHERE user_id = ? AND status = "Interview"').get(userId).cnt;
  const totalOffers = db.prepare('SELECT COUNT(*) as cnt FROM applications WHERE user_id = ? AND status = "Offer"').get(userId).cnt;

  const byPortal = db.prepare(`
    SELECT portal, COUNT(*) as count
    FROM applications
    WHERE user_id = ?
    GROUP BY portal
  `).all(userId);

  const statusPipeline = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM applications
    WHERE user_id = ?
    GROUP BY status
  `).all(userId);

  res.json({
    metrics: {
      discovered: totalDiscovered,
      matched: totalMatched,
      applicationsTotal: totalApplications,
      submitted: totalSubmitted,
      failed: totalFailed,
      interviews: totalInterviews,
      offers: totalOffers
    },
    byPortal,
    statusPipeline
  });
});

module.exports = router;
