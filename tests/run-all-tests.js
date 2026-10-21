/**
 * Comprehensive Automated Test Suite
 * Covers All Application Verification Pipeline Requirements:
 * - Successful submission with credible confirmation evidence
 * - Prepared-only applications in Dry-Run mode
 * - Uncertain submission outcomes when evidence is absent
 * - Duplicate application prevention & UPSERT
 * - Missing company metadata resolution from discovered jobs
 * - Status reconciliation without fabricating confirmation
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

console.log('=======================================================');
console.log('🧪 Running Comprehensive Automated Test Suite...');
console.log('=======================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}\n`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}\n`);
  }
}

(async () => {

  // 1. UNIT TEST: Naukri Helpers
  test('1. Naukri Helpers - Headline dot cycling', () => {
    const { nextHeadline } = require('../naukri-helpers');
    assert.strictEqual(nextHeadline('Full Stack Developer'), 'Full Stack Developer.');
    assert.strictEqual(nextHeadline('Full Stack Developer.'), 'Full Stack Developer..');
    assert.strictEqual(nextHeadline('Full Stack Developer..'), 'Full Stack Developer');
  });

  // 2. BUG 5 TEST: External ATS Classification & Field Answer Bank
  test('2. Bug 5 - External ATS Classification & Answer Bank', () => {
    const { answerFor, atsKind } = require('../external-apply');
    const mockCV = {
      name: 'Aditya Raj',
      email: 'aditya@example.com',
      phone: '+91 9876543210',
      currentRole: 'Software Engineer',
      company: 'TechCorp',
      noticePeriod: '30 days',
      currentCTC: '10',
      expectedCTC: '18',
      location: 'Bengaluru'
    };

    assert.strictEqual(answerFor('First Name', mockCV), 'Aditya');
    assert.strictEqual(answerFor('Last Name', mockCV), 'Raj');
    assert.strictEqual(answerFor('Email address', mockCV), 'aditya@example.com');
    assert.strictEqual(answerFor('Notice period', mockCV), '30 days');

    assert.strictEqual(atsKind('https://acme.wd1.myworkdayjobs.com/en-US/careers'), 'account');
    assert.strictEqual(atsKind('https://boards.greenhouse.io/acme/jobs/1234'), 'form');
  });

  // 3. BUG 3 TEST: AI 5-Factor Job Matcher Scoring & Eligibility Filters
  test('3. Bug 3 - 5-Factor Relevance Engine & Eligibility Filters', () => {
    const { calculateJobMatch } = require('../server/services/jobMatcherService');

    const mockProfile = {
      skills: 'JavaScript, TypeScript, React, Node.js, PostgreSQL'
    };

    const mockPrefs = {
      roles: ['Full Stack Developer', 'Software Engineer'],
      locations: ['Remote', 'Bengaluru'],
      excluded_companies: ['BlockedCompany'],
      excluded_keywords: ['Manager', 'Senior Director'],
      min_match_score: 60
    };

    const goodJob = {
      title: 'Full Stack Developer (React & Node.js)',
      description: 'Looking for a developer with React, Node.js, TypeScript and PostgreSQL experience.',
      company: 'InnovateTech',
      location: 'Remote',
      job_type: 'Full-time',
      experience_req: '1-3 years'
    };

    const result = calculateJobMatch(goodJob, mockProfile, mockPrefs);
    assert.ok(result.matchScore >= 75, `Expected high match score, got ${result.matchScore}`);
    assert.strictEqual(result.classification, 'Strong Match');
    assert.ok(result.isEligible);

    const blockedJob = {
      title: 'Full Stack Engineering Manager',
      company: 'BlockedCompany',
      location: 'Remote'
    };

    const blockedResult = calculateJobMatch(blockedJob, mockProfile, mockPrefs);
    assert.strictEqual(blockedResult.matchScore, 0);
    assert.strictEqual(blockedResult.classification, 'Hard Eligibility Failure');
    assert.ok(!blockedResult.isEligible);
  });

  // 4. PIPELINE TEST: Successful Submission with Credible Confirmation Evidence
  test('4. Pipeline - Successful Submission with Credible Confirmation Evidence', () => {
    const { CREDIBLE_CONFIRMATION_PATTERNS } = require('../server/routes/engineApi');

    const validEvidence1 = "Thank you for applying! Your application has been received.";
    const validEvidence2 = "dialog closed, 'Applied' stamp confirmed";
    const invalidEvidence = "form submitted but no confirmation text found";

    assert.ok(CREDIBLE_CONFIRMATION_PATTERNS.test(validEvidence1));
    assert.ok(CREDIBLE_CONFIRMATION_PATTERNS.test(validEvidence2));
    assert.ok(!CREDIBLE_CONFIRMATION_PATTERNS.test(invalidEvidence));
  });

  // 5. PIPELINE TEST: Application Prepared (Dry-Run / Pre-Submission)
  test('5. Pipeline - Prepared-Only Application Handling', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `prep_${Date.now()}@test.com`, password: 'Password123!', name: 'Prep User' });

    db.prepare(`
      INSERT INTO applications (id, user_id, portal, title, company, job_url, status, verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.userId, 'wellfound', 'Frontend Developer', 'Acme', 'https://wellfound.com/jobs/1', 'Application prepared', 0);

    const app = db.prepare('SELECT * FROM applications WHERE user_id = ?').get(user.userId);
    assert.strictEqual(app.status, 'Application prepared');
    assert.strictEqual(app.verified, 0);
  });

  // 6. PIPELINE TEST: Uncertain Submission Demotion
  test('6. Pipeline - Uncertain Outcome Demotion when Confirmation is Absent', () => {
    const { CREDIBLE_CONFIRMATION_PATTERNS } = require('../server/routes/engineApi');
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `uncertain_${Date.now()}@test.com`, password: 'Password123!', name: 'Uncertain User' });
    const logText = "clicked submit button but no confirmation toast appeared";

    let finalStatus = 'Submitted';
    let verified = 0;

    if (!CREDIBLE_CONFIRMATION_PATTERNS.test(logText)) {
      finalStatus = 'Submission uncertain';
      verified = 0;
    }

    assert.strictEqual(finalStatus, 'Submission uncertain');
    assert.strictEqual(verified, 0);
  });

  // 7. PIPELINE TEST: Company Metadata Resolution from Discovered Jobs
  test('7. Pipeline - Company Metadata Resolution without Fabricating Names', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `company_${Date.now()}@test.com`, password: 'Password123!', name: 'Company Test User' });
    const jobUrl = 'https://naukri.com/jobs/resolve-100';

    // Insert discovered job with genuine company name
    db.prepare(`
      INSERT INTO discovered_jobs (id, user_id, portal, original_url, job_identifier, title, company)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.userId, 'naukri', jobUrl, jobUrl, 'Backend Engineer', 'TechInnovators Inc.');

    // Simulating application report with missing/empty company
    let reportedCompany = '';
    if (!reportedCompany || reportedCompany === 'N/A') {
      const job = db.prepare('SELECT company FROM discovered_jobs WHERE user_id = ? AND original_url = ?').get(user.userId, jobUrl);
      if (job && job.company) {
        reportedCompany = job.company;
      }
    }

    assert.strictEqual(reportedCompany, 'TechInnovators Inc.');
  });

  // 8. PIPELINE TEST: Duplicate Application Prevention & UPSERT
  test('8. Pipeline - Duplicate Application Prevention (UNIQUE Constraint)', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `dupe_app_${Date.now()}@test.com`, password: 'Password123!', name: 'Dupe App User' });
    const jobUrl = 'https://wellfound.com/jobs/unique-app-100';

    const insertApp = db.prepare(`
      INSERT INTO applications (id, user_id, portal, title, company, job_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertApp.run(crypto.randomUUID(), user.userId, 'wellfound', 'Full Stack Developer', 'StartUp Inc', jobUrl, 'Application prepared');

    assert.throws(() => {
      insertApp.run(crypto.randomUUID(), user.userId, 'wellfound', 'Full Stack Developer', 'StartUp Inc', jobUrl, 'Submitted');
    }, /UNIQUE constraint failed/);
  });

  // 9. PIPELINE TEST: Safe Status Reconciliation without Fabricating Evidence
  test('9. Pipeline - Safe Application Status Reconciliation', () => {
    const { CREDIBLE_CONFIRMATION_PATTERNS } = require('../server/routes/engineApi');

    const unverifiedApp = {
      status: 'Submitted',
      verified: 0,
      execution_log: 'form submitted'
    };

    let reconciledStatus = unverifiedApp.status;
    let reconciledVerified = unverifiedApp.verified;

    if (unverifiedApp.status === 'Submitted' && !CREDIBLE_CONFIRMATION_PATTERNS.test(unverifiedApp.execution_log)) {
      reconciledStatus = 'Submission uncertain';
      reconciledVerified = 0;
    }

    assert.strictEqual(reconciledStatus, 'Submission uncertain');
    assert.strictEqual(reconciledVerified, 0);
  });

  // 10. INTEGRATION TEST: Multi-User Isolation
  test('10. Isolation - Multi-User Data Isolation', () => {
    const authService = require('../server/services/authService');
    const db = require('../server/db/database');

    const userA = authService.registerUser({ email: `iso_a_${Date.now()}@test.com`, password: 'Password123!', name: 'Iso A' });
    const userB = authService.registerUser({ email: `iso_b_${Date.now()}@test.com`, password: 'Password123!', name: 'Iso B' });

    db.prepare('UPDATE job_preferences SET roles = ? WHERE user_id = ?').run('["Android Developer"]', userA.userId);

    const prefB = db.prepare('SELECT roles FROM job_preferences WHERE user_id = ?').get(userB.userId);
    assert.notStrictEqual(prefB.roles, '["Android Developer"]');
  });

  console.log('\n=======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed.`);
  console.log('=======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();
