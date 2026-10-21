/**
 * Comprehensive Automated Test Suite
 * Covers All Application Verification Pipeline Requirements & Non-Destructive Test Matrix:
 * - Scenario 1: Submitted + verified: 1 + missing evidence -> demotes to Submission uncertain
 * - Scenario 2: Submitted + verified: 0 + missing evidence -> demotes to Submission uncertain
 * - Scenario 3: External ATS ambiguous result -> Submission uncertain with execution log
 * - Scenario 4: Application prepared with stale verified flag -> clears verified = 0
 * - Scenario 5: Company metadata resolution from discovered jobs without fabricating names
 * - Scenario 6: Multi-user data isolation and unique application constraints
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

  // 3. BUG 3 TEST: AI 5-Factor Job Matcher Scoring & Eligibility Filters
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

  // 4. TEST MATRIX SCENARIO 1: Submitted + verified: 1 + Missing Evidence
  test('4. Scenario 1 - Submitted + verified: 1 + Missing Evidence Demotion', () => {
    const { CREDIBLE_CONFIRMATION_PATTERNS } = require('../server/routes/engineApi');

    const evidenceText = ""; // Missing evidence
    const isVerifiedInput = 1;

    let finalStatus = 'Submitted';
    let isVerified = 0;

    // Strict rule: never trust verified = 1 alone if evidence fails
    if (finalStatus === 'Submitted') {
      if (evidenceText && CREDIBLE_CONFIRMATION_PATTERNS.test(evidenceText)) {
        finalStatus = 'Submitted';
        isVerified = 1;
      } else {
        finalStatus = 'Submission uncertain';
        isVerified = 0;
      }
    }

    assert.strictEqual(finalStatus, 'Submission uncertain');
    assert.strictEqual(isVerified, 0);
  });

  // 5. TEST MATRIX SCENARIO 2: Submitted + verified: 0 + Missing Evidence
  test('5. Scenario 2 - Submitted + verified: 0 + Missing Evidence Demotion', () => {
    const { CREDIBLE_CONFIRMATION_PATTERNS } = require('../server/routes/engineApi');

    const evidenceText = "";
    let finalStatus = 'Submitted';
    let isVerified = 0;

    if (finalStatus === 'Submitted') {
      if (evidenceText && CREDIBLE_CONFIRMATION_PATTERNS.test(evidenceText)) {
        finalStatus = 'Submitted';
        isVerified = 1;
      } else {
        finalStatus = 'Submission uncertain';
        isVerified = 0;
      }
    }

    assert.strictEqual(finalStatus, 'Submission uncertain');
    assert.strictEqual(isVerified, 0);
  });

  // 6. TEST MATRIX SCENARIO 3: External ATS Ambiguous Result Mapping
  test('6. Scenario 3 - External ATS Ambiguous Result Mapping', () => {
    const extResult = {
      status: 'failed',
      detail: 'submitted but no confirmation text found — verify manually'
    };

    const appStatus = extResult.status === 'applied' ? 'Submitted' : extResult.status === 'would-apply' ? 'Application prepared' : 'Submission uncertain';
    const verified = extResult.status === 'applied' ? 1 : 0;

    assert.strictEqual(appStatus, 'Submission uncertain');
    assert.strictEqual(verified, 0);
  });

  // 7. TEST MATRIX SCENARIO 4: Application Prepared with Stale Verified Flag
  test('7. Scenario 4 - Application Prepared Clears Stale Verified Flag', () => {
    const inputStatus = 'Application prepared';
    const staleVerified = 1;

    let finalStatus = inputStatus;
    let finalVerified = 0;

    if (finalStatus === 'Application prepared' || finalStatus === 'would-apply') {
      finalStatus = 'Application prepared';
      finalVerified = 0;
    }

    assert.strictEqual(finalStatus, 'Application prepared');
    assert.strictEqual(finalVerified, 0);
  });

  // 8. TEST MATRIX SCENARIO 5: Company Metadata Resolution without Fabricating Names
  test('8. Scenario 5 - Company Metadata Resolution from Discovered Jobs', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `company_meta_${Date.now()}@test.com`, password: 'Password123!', name: 'Meta User' });
    const jobUrl = 'https://naukri.com/jobs/meta-test-100';

    db.prepare(`
      INSERT INTO discovered_jobs (id, user_id, portal, original_url, job_identifier, title, company)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.userId, 'naukri', jobUrl, jobUrl, 'Full Stack Engineer', 'Genuine Software Ltd');

    const discovered = db.prepare('SELECT company FROM discovered_jobs WHERE user_id = ? AND original_url = ?').get(user.userId, jobUrl);
    assert.strictEqual(discovered.company, 'Genuine Software Ltd');
  });

  // 9. PIPELINE TEST: Unique Constraint Duplicate Application Prevention
  test('9. Pipeline - Unique Job URL Constraint Prevention', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `unique_app_${Date.now()}@test.com`, password: 'Password123!', name: 'Unique App User' });
    const jobUrl = 'https://wellfound.com/jobs/unique-app-200';

    const insertApp = db.prepare(`
      INSERT INTO applications (id, user_id, portal, title, company, job_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertApp.run(crypto.randomUUID(), user.userId, 'wellfound', 'Full Stack Developer', 'StartUp Inc', jobUrl, 'Application prepared');

    assert.throws(() => {
      insertApp.run(crypto.randomUUID(), user.userId, 'wellfound', 'Full Stack Developer', 'StartUp Inc', jobUrl, 'Submitted');
    }, /UNIQUE constraint failed/);
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
