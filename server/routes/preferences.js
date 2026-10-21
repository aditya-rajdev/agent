/**
 * Preferences Routes - Manages Editable Job Preferences, Roles, Locations & Filters
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('./auth');
const db = require('../db/database');

router.get('/', authenticate, (req, res) => {
  let prefs = db.prepare('SELECT * FROM job_preferences WHERE user_id = ?').get(req.user.userId);
  if (!prefs) {
    db.prepare('INSERT INTO job_preferences (user_id) VALUES (?)').run(req.user.userId);
    prefs = db.prepare('SELECT * FROM job_preferences WHERE user_id = ?').get(req.user.userId);
  }

  // Parse JSON columns
  ['roles', 'job_types', 'locations', 'excluded_locations', 'excluded_companies', 'excluded_keywords'].forEach(col => {
    try {
      prefs[col] = JSON.parse(prefs[col] || '[]');
    } catch (e) {
      prefs[col] = [];
    }
  });

  res.json({ preferences: prefs });
});

router.put('/', authenticate, (req, res) => {
  const {
    roles, job_types, locations, excluded_locations, min_salary, max_salary,
    experience_level, graduation_year, company_preferences, excluded_companies,
    excluded_keywords, max_applications_per_day, min_match_score
  } = req.body;

  db.prepare(`
    UPDATE job_preferences SET
      roles = ?,
      job_types = ?,
      locations = ?,
      excluded_locations = ?,
      min_salary = ?,
      max_salary = ?,
      experience_level = ?,
      graduation_year = ?,
      company_preferences = ?,
      excluded_companies = ?,
      excluded_keywords = ?,
      max_applications_per_day = ?,
      min_match_score = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    JSON.stringify(roles || []),
    JSON.stringify(job_types || []),
    JSON.stringify(locations || []),
    JSON.stringify(excluded_locations || []),
    min_salary || 0,
    max_salary || 0,
    experience_level || 'Entry-level',
    graduation_year || '',
    company_preferences || '',
    JSON.stringify(excluded_companies || []),
    JSON.stringify(excluded_keywords || []),
    max_applications_per_day || 30,
    min_match_score || 50,
    req.user.userId
  );

  res.json({ message: 'Job preferences saved successfully.' });
});

module.exports = router;
