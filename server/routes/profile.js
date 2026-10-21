/**
 * Profile Routes - Candidate Profile & Resumes Management
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const { authenticate } = require('./auth');
const db = require('../db/database');
const resumeParser = require('../services/resumeParserService');

// File upload configuration
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.user.userId}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.docx', '.doc'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed.'));
    }
  }
});

router.get('/', authenticate, (req, res) => {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.userId);
  const resumes = db.prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY uploaded_at DESC').all(req.user.userId);

  if (profile && profile.highlights) {
    try {
      profile.highlights = JSON.parse(profile.highlights);
    } catch (e) {
      profile.highlights = [];
    }
  }

  res.json({ profile, resumes });
});

router.put('/', authenticate, (req, res) => {
  const {
    current_role, company, education, years_experience, skills,
    highlights, notice_period, current_ctc, expected_ctc, dob, gender,
    work_auth, github_url, linkedin_url, portfolio_url, location, relocate_pref, remote_pref, cover_letter_template
  } = req.body;

  const highlightsJson = Array.isArray(highlights) ? JSON.stringify(highlights) : (highlights || '[]');

  db.prepare(`
    UPDATE profiles SET
      current_role = ?, company = ?, education = ?, years_experience = ?, skills = ?,
      highlights = ?, notice_period = ?, current_ctc = ?, expected_ctc = ?, dob = ?, gender = ?,
      work_auth = ?, github_url = ?, linkedin_url = ?, portfolio_url = ?, location = ?,
      relocate_pref = ?, remote_pref = ?, cover_letter_template = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    current_role || '', company || '', education || '', years_experience || '', skills || '',
    highlightsJson, notice_period || '30 days', current_ctc || '0', expected_ctc || '0', dob || '', gender || '',
    work_auth || '', github_url || '', linkedin_url || '', portfolio_url || '', location || '',
    relocate_pref || '', remote_pref || '', cover_letter_template || '', req.user.userId
  );

  res.json({ message: 'Profile updated successfully.' });
});

router.post('/resumes', authenticate, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded.' });
    }

    const resumeId = crypto.randomUUID();
    let parsedText = '';
    let extractedData = {};

    if (req.file.filename.toLowerCase().endsWith('.pdf')) {
      try {
        parsedText = await resumeParser.extractTextFromPDF(req.file.path);
        extractedData = resumeParser.parseResumeDetails(parsedText);
      } catch (e) {
        console.warn('PDF parsing warning:', e.message);
      }
    }

    // Set previous resumes as not primary if this is primary
    db.prepare('UPDATE resumes SET is_primary = 0 WHERE user_id = ?').run(req.user.userId);

    db.prepare(`
      INSERT INTO resumes (id, user_id, filename, file_path, file_type, parsed_text, extracted_data, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      resumeId, req.user.userId, req.file.originalname, req.file.path,
      path.extname(req.file.originalname).replace('.', '').toLowerCase(),
      parsedText, JSON.stringify(extractedData)
    );

    res.json({
      message: 'Resume uploaded and parsed successfully.',
      resume: { id: resumeId, filename: req.file.originalname, extractedData }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/resumes/:id', authenticate, (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!resume) {
    return res.status(404).json({ error: 'Resume not found.' });
  }

  try {
    if (fs.existsSync(resume.file_path)) {
      fs.unlinkSync(resume.file_path);
    }
  } catch (e) {}

  db.prepare('DELETE FROM resumes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Resume deleted successfully.' });
});

module.exports = router;
