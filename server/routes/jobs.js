/**
 * Jobs Routes - Discovered Jobs, Filters, Search, AI Match Score calculation
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');
const { calculateJobMatch } = require('../services/jobMatcherService');

router.get('/', authenticate, (req, res) => {
  const { portal, minScore, status, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM discovered_jobs WHERE user_id = ?';
  const params = [req.user.userId];

  if (portal) {
    query += ' AND portal = ?';
    params.push(portal);
  }

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (minScore) {
    query += ' AND match_score >= ?';
    params.push(parseInt(minScore));
  }

  if (search) {
    query += ' AND (title LIKE ? OR company LIKE ? OR location LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const jobs = db.prepare(query).all(...params);

  // Parse JSON columns
  jobs.forEach(job => {
    try {
      job.missing_skills = JSON.parse(job.missing_skills || '[]');
    } catch (e) {
      job.missing_skills = [];
    }
  });

  const countQuery = 'SELECT COUNT(*) as total FROM discovered_jobs WHERE user_id = ?';
  const total = db.prepare(countQuery).get(req.user.userId).total;

  res.json({ jobs, total, page: parseInt(page), limit: parseInt(limit) });
});

router.post('/calculate-match', authenticate, (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.userId);
  let prefs = db.prepare('SELECT * FROM job_preferences WHERE user_id = ?').get(req.user.userId);

  if (prefs) {
    ['roles', 'job_types', 'locations', 'excluded_companies', 'excluded_keywords'].forEach(col => {
      try {
        prefs[col] = JSON.parse(prefs[col] || '[]');
      } catch (e) {
        prefs[col] = [];
      }
    });
  }

  const match = calculateJobMatch(req.body.job, profile || {}, prefs || {});
  res.json(match);
});

router.post('/save', authenticate, (req, res) => {
  const { jobId } = req.body;
  db.prepare('UPDATE discovered_jobs SET status = "Saved" WHERE id = ? AND user_id = ?').run(jobId, req.user.userId);
  res.json({ message: 'Job saved successfully.' });
});

module.exports = router;
