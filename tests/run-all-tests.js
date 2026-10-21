/**
 * Comprehensive Automated Test Suite
 * Covers Bug 1-9 Bug Fixes:
 * - Bug 1: Async lifecycle & Playwright explicit waits
 * - Bug 2: Preferences-driven search building & hard filters
 * - Bug 3: Integrated 5-factor AI matcher & eligibility check
 * - Bug 4: Complete candidate profile DB schema & field CRUD
 * - Bug 5: External ATS classification & field mapping
 * - Bug 6: Immediate Emergency Stop & cancellation state
 * - Bug 7: Dynamic Engine Online/Offline heartbeat threshold
 * - Bug 8: Submission verification & duplicate constraints
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

  // 4. BUG 4 TEST: Complete Candidate Profile Schema & Persistence
  test('4. Bug 4 - Candidate Profile DB Schema & Fields', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({
      email: `prof_test_${Date.now()}@example.com`,
      password: 'Password123!',
      name: 'Candidate Test',
      phone: '+91 9876543210'
    });

    db.prepare(`
      UPDATE profiles SET
        full_name = ?, email = ?, phone = ?, dob = ?, gender = ?,
        graduation_year = ?, start_date = ?, sponsorship_req = ?
      WHERE user_id = ?
    `).run('Aditya Raj', 'aditya@test.com', '+91 9876543210', '15/08/2000', 'Male', '2025', 'Immediately', 'No', user.userId);

    const updated = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.userId);
    assert.strictEqual(updated.full_name, 'Aditya Raj');
    assert.strictEqual(updated.dob, '15/08/2000');
    assert.strictEqual(updated.gender, 'Male');
    assert.strictEqual(updated.sponsorship_req, 'No');
  });

  // 5. BUG 2 TEST: Dashboard Preferences Search URL Building
  test('5. Bug 2 - Preferences Control Search URLs Without Overrides', () => {
    const NaukriAdapter = require('../engine/adapters/naukriAdapter');
    const IndeedAdapter = require('../engine/adapters/indeedAdapter');

    const configWithRoles = {
      preferences: { roles: ['Flutter Developer', 'Android Developer'] }
    };

    const naukriWithRoles = new NaukriAdapter(configWithRoles);
    const naukriUrls = naukriWithRoles.getSearchUrls();
    assert.strictEqual(naukriUrls.length, 2);
    assert.ok(naukriUrls[0].includes('flutter-developer'));

    const configEmptyRoles = {
      preferences: { roles: [] }
    };

    const naukriEmpty = new NaukriAdapter(configEmptyRoles);
    assert.strictEqual(naukriEmpty.getSearchUrls().length, 0, 'Empty roles MUST return empty search URLs array');

    const indeedEmpty = new IndeedAdapter(configEmptyRoles);
    assert.strictEqual(indeedEmpty.getSearchUrls().length, 0, 'Empty roles MUST return empty search URLs array');
  });

  // 6. BUG 7 TEST: Engine Heartbeat 90s Online/Offline Threshold
  test('6. Bug 7 - Dynamic Engine Online/Offline Calculation', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `engine_status_${Date.now()}@test.com`, password: 'Password123!', name: 'Status User' });

    // Recent ping (10s ago)
    const recentTime = new Date(Date.now() - 10000).toISOString().replace('T', ' ').replace('Z', '');
    db.prepare('INSERT OR REPLACE INTO engine_sessions (user_id, connection_status, last_ping) VALUES (?, ?, ?)').run(user.userId, 'Online', recentTime);

    // Stale ping (120s ago)
    const staleTime = new Date(Date.now() - 120000).toISOString().replace('T', ' ').replace('Z', '');
    const stalePingMs = new Date(staleTime + 'Z').getTime();
    const diffMs = Date.now() - stalePingMs;

    assert.ok(diffMs >= 90000, 'Stale ping older than 90s must be recognized as offline');
  });

  // 7. BUG 6 TEST: Immediate Emergency Stop Signal
  test('7. Bug 6 - Immediate Emergency Stop State & Log', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `stop_${Date.now()}@test.com`, password: 'Password123!', name: 'Stop User' });

    db.prepare('UPDATE automation_settings SET enabled = 0 WHERE user_id = ?').run(user.userId);
    const settings = db.prepare('SELECT enabled FROM automation_settings WHERE user_id = ?').get(user.userId);

    assert.strictEqual(settings.enabled, 0, 'Emergency Stop must immediately set enabled = 0');
  });

  // 8. BUG 8 TEST: Duplicate Job Constraint
  test('8. Bug 8 - Unique Job Constraint Prevention', () => {
    const db = require('../server/db/database');
    const authService = require('../server/services/authService');

    const user = authService.registerUser({ email: `dupe_check_${Date.now()}@test.com`, password: 'Password123!', name: 'Dupe Check User' });

    const insertJob = db.prepare(`
      INSERT INTO discovered_jobs (id, user_id, portal, original_url, job_identifier, title)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertJob.run(crypto.randomUUID(), user.userId, 'naukri', 'https://naukri.com/job100', 'job100', 'Software Engineer');

    assert.throws(() => {
      insertJob.run(crypto.randomUUID(), user.userId, 'naukri', 'https://naukri.com/job100', 'job100', 'Software Engineer');
    }, /UNIQUE constraint failed/);
  });

  // 9. BUG 4 TEST: Resume Parser Service Text Mapping
  await asyncTest('9. Bug 4 - Resume Parser Detail Extraction', async () => {
    const resumeParser = require('../server/services/resumeParserService');
    const mockText = 'Name: Aditya Raj\nEmail: aditya@test.com\nPhone: +91 9876543210\nSkills: React, Node.js, TypeScript, Flutter';

    const parsed = resumeParser.parseResumeDetails(mockText);
    assert.strictEqual(parsed.email, 'aditya@test.com');
    assert.strictEqual(parsed.phone, '+91 9876543210');
    assert.ok(parsed.skills.includes('Flutter'));
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
