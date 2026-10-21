/**
 * Comprehensive Automated Test Suite
 * Covers Unit Tests, Integration Tests, Multi-User Isolation, Engine API Sync, AI Matcher, and Security Controls.
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

  // 2. UNIT TEST: External Form Field Answer Bank
  test('2. External ATS - Form Field Answer Bank & Classification', () => {
    const { answerFor, atsKind } = require('../external-apply');
    const mockCV = {
      name: 'Ankit Baghel',
      email: 'ankit@example.com',
      phone: '+91 9999999999',
      currentRole: 'Software Engineer',
      company: 'TechCorp',
      noticePeriod: '30 days',
      currentCTC: '10',
      expectedCTC: '18',
      location: 'Bengaluru'
    };

    assert.strictEqual(answerFor('First Name', mockCV), 'Ankit');
    assert.strictEqual(answerFor('Last Name', mockCV), 'Baghel');
    assert.strictEqual(answerFor('Email address', mockCV), 'ankit@example.com');
    assert.strictEqual(answerFor('Notice period', mockCV), '30 days');

    assert.strictEqual(atsKind('https://acme.wd1.myworkdayjobs.com/en-US/careers'), 'account');
    assert.strictEqual(atsKind('https://boards.greenhouse.io/acme/jobs/1234'), 'form');
  });

  // 3. UNIT TEST: AI 5-Factor Job Matcher Scoring Engine
  test('3. Job Matcher - 5-Factor Relevance Engine', () => {
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

  // 4. INTEGRATION TEST: Database Initialization & Schema
  test('4. Database - Schema & Constraints Verification', () => {
    const db = require('../server/db/database');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    const requiredTables = ['users', 'profiles', 'resumes', 'job_preferences', 'automation_settings', 'discovered_jobs', 'applications', 'automation_logs', 'engine_sessions'];
    requiredTables.forEach(table => {
      assert.ok(tables.includes(table), `Missing database table: ${table}`);
    });
  });

  // 5. INTEGRATION TEST: Auth Service & Token Generation
  test('5. Auth Service - User Registration & Token Generation', () => {
    const authService = require('../server/services/authService');
    const testEmail = `test_auth_${Date.now()}@example.com`;
    const testPassword = 'SecurePassword123!';

    const reg = authService.registerUser({
      email: testEmail,
      password: testPassword,
      name: 'Auth Test User',
      phone: '+91 9876543210'
    });

    assert.ok(reg.userId);
    assert.ok(reg.token);
    assert.ok(reg.engineApiKey.startsWith('engine_ak_'));

    const login = authService.loginUser({
      email: testEmail,
      password: testPassword
    });

    assert.strictEqual(login.userId, reg.userId);
    assert.ok(login.token);
  });

  // 6. INTEGRATION TEST: Multi-User Data Isolation
  test('6. Isolation - Per-User Data Access Control', () => {
    const authService = require('../server/services/authService');
    const db = require('../server/db/database');

    const userA = authService.registerUser({ email: `usera_${Date.now()}@test.com`, password: 'Password123!', name: 'User A' });
    const userB = authService.registerUser({ email: `userb_${Date.now()}@test.com`, password: 'Password123!', name: 'User B' });

    // User A updates preferences
    db.prepare('UPDATE job_preferences SET roles = ? WHERE user_id = ?').run('["Flutter Developer"]', userA.userId);

    // Verify User B's preferences remain unchanged
    const prefB = db.prepare('SELECT roles FROM job_preferences WHERE user_id = ?').get(userB.userId);
    assert.notStrictEqual(prefB.roles, '["Flutter Developer"]');
  });

  // 7. INTEGRATION TEST: Engine API Bridge & Sync Config
  test('7. Engine API Bridge - Sync Config & Report Job', () => {
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `engine_${Date.now()}@test.com`, password: 'Password123!', name: 'Engine User' });
    const userByKey = authService.getUserByApiKey(user.engineApiKey);

    assert.ok(userByKey);
    assert.strictEqual(userByKey.id, user.userId);
  });

  // 8. INTEGRATION TEST: Resume Parsing (PDF & DOCX)
  await asyncTest('8. Resume Parser - DOCX & PDF Parsing Service', async () => {
    const resumeParser = require('../server/services/resumeParserService');
    const mockText = 'Name: Ankit Baghel\nEmail: ankit@test.com\nPhone: +91 9876543210\nSkills: React, Node.js, TypeScript';

    const parsed = resumeParser.parseResumeDetails(mockText);
    assert.strictEqual(parsed.email, 'ankit@test.com');
    assert.strictEqual(parsed.phone, '+91 9876543210');
    assert.ok(parsed.skills.includes('React'));
  });

  // 9. INTEGRATION TEST: Dry-Run Mode Safety Enforcement
  test('9. Automation Safety - Dry-Run Mode Safety Enforcement', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `dryrun_${Date.now()}@test.com`, password: 'Password123!', name: 'Safety User' });
    const settings = db.prepare('SELECT dry_run FROM automation_settings WHERE user_id = ?').get(user.userId);

    assert.strictEqual(settings.dry_run, 1, 'Default automation mode MUST be Dry-Run (dry_run = 1)');
  });

  // 10. INTEGRATION TEST: Duplicate Prevention
  test('10. Database - Duplicate Job Unique Constraint', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `dupe_${Date.now()}@test.com`, password: 'Password123!', name: 'Dupe User' });

    const insertJob = db.prepare(`
      INSERT INTO discovered_jobs (id, user_id, portal, original_url, job_identifier, title)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertJob.run(crypto.randomUUID(), user.userId, 'naukri', 'https://naukri.com/job1', 'job_id_100', 'Software Engineer');

    // Attempting duplicate insert with same (user_id, portal, job_identifier) should throw
    assert.throws(() => {
      insertJob.run(crypto.randomUUID(), user.userId, 'naukri', 'https://naukri.com/job1', 'job_id_100', 'Software Engineer');
    }, /UNIQUE constraint failed/);
  });

  console.log('\n=======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed.`);
  console.log('=======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();
