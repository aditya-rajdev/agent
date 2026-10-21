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
      profile.highlights = typeof profile.highlights === 'string' ? JSON.parse(profile.highlights) : profile.highlights;
    } catch (e) {
      profile.highlights = [];
    }
  }

  res.json({ profile, resumes });
});

router.put('/', authenticate, (req, res) => {
  const {
    full_name, email, phone, location, dob, gender, education, graduation_year,
    years_experience, skills, current_role, company, current_ctc, expected_ctc,
    notice_period, start_date, work_auth, sponsorship_req, relocate_pref, remote_pref,
    github_url, linkedin_url, portfolio_url, highlights, cover_letter_template
  } = req.body;

  const highlightsJson = Array.isArray(highlights) ? JSON.stringify(highlights) : (highlights || '[]');

  db.prepare(`
    UPDATE profiles SET
      full_name = ?, email = ?, phone = ?, location = ?, dob = ?, gender = ?,
      education = ?, graduation_year = ?, years_experience = ?, skills = ?,
      current_role = ?, company = ?, current_ctc = ?, expected_ctc = ?,
      notice_period = ?, start_date = ?, work_auth = ?, sponsorship_req = ?,
      relocate_pref = ?, remote_pref = ?, github_url = ?, linkedin_url = ?,
      portfolio_url = ?, highlights = ?, cover_letter_template = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    full_name || '', email || '', phone || '', location || '', dob || '', gender || 'Prefer not to say',
    education || '', graduation_year || '', years_experience || '', skills || '',
    current_role || '', company || '', current_ctc || '0', expected_ctc || '0',
    notice_period || '30 days', start_date || '', work_auth || 'Authorized to work', sponsorship_req || 'No',
    relocate_pref || '', remote_pref || '', github_url || '', linkedin_url || '',
    portfolio_url || '', highlightsJson, cover_letter_template || '', req.user.userId
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

    const fileExt = path.extname(req.file.originalname).toLowerCase();

    if (fileExt === '.pdf') {
      try {
        parsedText = await resumeParser.extractTextFromPDF(req.file.path);
        extractedData = resumeParser.parseResumeDetails(parsedText);
      } catch (e) {
        console.warn('PDF parsing warning:', e.message);
      }
    } else if (fileExt === '.docx' || fileExt === '.doc') {
      try {
        parsedText = await resumeParser.extractTextFromDOCX(req.file.path);
        extractedData = resumeParser.parseResumeDetails(parsedText);
      } catch (e) {
        console.warn('DOCX parsing warning:', e.message);
      }
    }

    // Set previous resumes as not primary if this is primary
    db.prepare('UPDATE resumes SET is_primary = 0 WHERE user_id = ?').run(req.user.userId);

    db.prepare(`
      INSERT INTO resumes (id, user_id, filename, file_path, file_type, parsed_text, extracted_data, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      resumeId, req.user.userId, req.file.originalname, req.file.path,
      fileExt.replace('.', ''),
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

// Secure Download Endpoint with Ownership Validation
router.get('/resumes/download/:id', authenticate, (req, res) => {
  const resume = db.prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!resume) {
    return res.status(404).json({ error: 'Resume not found or unauthorized.' });
  }

  if (!fs.existsSync(resume.file_path)) {
    return res.status(404).json({ error: 'Resume file missing on server.' });
  }

  res.download(resume.file_path, resume.filename);
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
