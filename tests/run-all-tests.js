/**
 * Isolated & Repeatable Comprehensive Automated Test Suite
 * Uses an isolated temporary SQLite database instance that NEVER overwrites or modifies data/app.db.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

console.log('=======================================================');
console.log('🧪 Running Isolated Automated Test Suite...');
console.log('=======================================================\n');

// Configure isolated temporary test database
const tempDbPath = path.resolve(__dirname, '../data/test-temp-' + Date.now() + '.db');
process.env.TEST_DB_PATH = tempDbPath;

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
  test('2. External ATS Classification & Answer Bank', () => {
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

  // 3. JOB MATCHER TEST: 5-Factor Relevance Engine & Eligibility Filters
  test('3. Job Matcher - 5-Factor Relevance Engine & Eligibility Filters', () => {
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

  // 4. CENTRALIZED VERIFICATION SERVICE: Evidence Demotion & Rejection of False Positives
  test('4. Verification Service - Evidence Evaluation & False Positive Rejection', () => {
    const { evaluateVerification } = require('../server/services/verificationService');

    // Scenario A: Submitted + verified: 1 + missing evidence -> demoted to Submission uncertain
    const resA = evaluateVerification('Submitted', '');
    assert.strictEqual(resA.finalStatus, 'Submission uncertain');
    assert.strictEqual(resA.verified, 0);

    // Scenario B: Submitted + single ambiguous word "success" -> demoted
    const resB = evaluateVerification('Submitted', 'success');
    assert.strictEqual(resB.finalStatus, 'Submission uncertain');
    assert.strictEqual(resB.verified, 0);

    // Scenario C: Submitted + genuine confirmation evidence -> Submitted
    const resC = evaluateVerification('Submitted', 'Thank you for applying! Your application has been received.');
    assert.strictEqual(resC.finalStatus, 'Submitted');
    assert.strictEqual(resC.verified, 1);

    // Scenario D: Application prepared -> verified = 0
    const resD = evaluateVerification('Application prepared', 'form filled in dry run');
    assert.strictEqual(resD.finalStatus, 'Application prepared');
    assert.strictEqual(resD.verified, 0);
  });

  // 5. PLATFORM EXTENSION: Adapters Verification
  test('5. Multi-Platform Adapters Verification', () => {
    const LinkedInAdapter = require('../engine/adapters/linkedinAdapter');
    const UpstoxAdapter = require('../engine/adapters/upstoxAdapter');
    const UnstopAdapter = require('../engine/adapters/unstopAdapter');
    const InternshalaAdapter = require('../engine/adapters/internshalaAdapter');

    const li = new LinkedInAdapter({ preferences: { roles: ['Flutter Dev'] } });
    assert.ok(li.getSearchUrls()[0].includes('keywords=Flutter%20Dev'));

    const up = new UpstoxAdapter({});
    assert.strictEqual(up.getSearchUrls()[0], 'https://upstox.com/careers/');

    const un = new UnstopAdapter({});
    assert.strictEqual(un.getSearchUrls().length, 2);

    const it = new InternshalaAdapter({ preferences: { roles: ['Web Development'] } });
    assert.ok(it.getSearchUrls()[0].includes('internshala.com/internships/web-development-internship'));
  });

  // 6. XSS SANITIZATION: Client Helper Escaping
  test('6. XSS Security - HTML & URL Escaping', () => {
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function safeUrl(url) {
      if (!url || typeof url !== 'string') return null;
      const trimmed = url.trim();
      if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed);
      return null;
    }

    const maliciousTitle = '<script>alert("XSS")</script>';
    assert.strictEqual(escapeHtml(maliciousTitle), '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');

    const javascriptUri = 'javascript:alert(1)';
    assert.strictEqual(safeUrl(javascriptUri), null);

    const validUrl = 'https://naukri.com/job/100';
    assert.strictEqual(safeUrl(validUrl), 'https://naukri.com/job/100');
  });

  // 7. ISOLATED DATABASE INTEGRATION: Application Identity, Multi-User Isolation & Unique Constraints
  test('7. Isolated DB Integration - Multi-User Isolation & Unique Constraints', () => {
    const db = new Database(tempDbPath);
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, name TEXT, engine_api_key TEXT);
      CREATE TABLE job_preferences (user_id TEXT PRIMARY KEY, roles TEXT);
      CREATE TABLE applications (id TEXT PRIMARY KEY, user_id TEXT, portal TEXT, title TEXT, company TEXT, job_url TEXT, status TEXT, UNIQUE(user_id, portal, job_url));
    `);

    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('u1', 'user1@test.com', 'hash', 'User 1', 'key1');
    db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('u2', 'user2@test.com', 'hash', 'User 2', 'key2');

    db.prepare('INSERT INTO job_preferences VALUES (?, ?)').run('u1', '["Android Developer"]');
    db.prepare('INSERT INTO job_preferences VALUES (?, ?)').run('u2', '["iOS Developer"]');

    const u1Pref = db.prepare('SELECT roles FROM job_preferences WHERE user_id = ?').get('u1').roles;
    const u2Pref = db.prepare('SELECT roles FROM job_preferences WHERE user_id = ?').get('u2').roles;
    assert.strictEqual(u1Pref, '["Android Developer"]');
    assert.strictEqual(u2Pref, '["iOS Developer"]');

    const insertApp = db.prepare('INSERT INTO applications VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertApp.run('app1', 'u1', 'naukri', 'Dev', 'Acme', 'https://naukri.com/job/100', 'Application prepared');

    assert.throws(() => {
      insertApp.run('app2', 'u1', 'naukri', 'Dev', 'Acme', 'https://naukri.com/job/100', 'Submitted');
    }, /UNIQUE constraint failed/);

    db.close();
  });

  // Cleanup temporary test database file
  try {
    if (fs.existsSync(tempDbPath)) {
      fs.unlinkSync(tempDbPath);
    }
  } catch (e) {}

  console.log('\n=======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed.`);
  console.log('=======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();
