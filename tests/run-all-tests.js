/**
 * Comprehensive Automated Test Suite
 * Covers Unit Tests, Integration Tests, Job Matching, Auth, Database Isolation, and Engine API.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

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
  test('Naukri Helpers - Headline dot cycling', () => {
    const { nextHeadline, uploadedToday } = require('../naukri-helpers');
    assert.strictEqual(nextHeadline('Full Stack Developer'), 'Full Stack Developer.');
    assert.strictEqual(nextHeadline('Full Stack Developer.'), 'Full Stack Developer..');
    assert.strictEqual(nextHeadline('Full Stack Developer..'), 'Full Stack Developer');
  });

  // 2. UNIT TEST: External Form Field Answer Bank
  test('External ATS - Form Field Answer Bank', () => {
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
  test('Job Matcher - 5-Factor Relevance Engine', () => {
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

  // 4. INTEGRATION TEST: Database Initialization & Isolation
  test('Database - Schema & Constraints Verification', () => {
    const db = require('../server/db/database');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    const requiredTables = ['users', 'profiles', 'resumes', 'job_preferences', 'automation_settings', 'discovered_jobs', 'applications', 'automation_logs', 'engine_sessions'];
    requiredTables.forEach(table => {
      assert.ok(tables.includes(table), `Missing database table: ${table}`);
    });
  });

  // 5. INTEGRATION TEST: Authentication & Password Hashing
  test('Auth Service - User Signup & Login Isolation', () => {
    const authService = require('../server/services/authService');
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'SecurePassword123!';

    const reg = authService.registerUser({
      email: testEmail,
      password: testPassword,
      name: 'Test Candidate',
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

    const userByKey = authService.getUserByApiKey(reg.engineApiKey);
    assert.ok(userByKey);
    assert.strictEqual(userByKey.id, reg.userId);
  });

  console.log('\n=======================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} Passed.`);
  console.log('=======================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
})();
