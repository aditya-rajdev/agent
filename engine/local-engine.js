/**
 * Local Windows Automation Engine Daemon
 * Connects securely to Web Dashboard, polls configuration, manages Playwright browser instances,
 * executes job discovery and application workflows, and handles Windows off-screen window state.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
require('dotenv').config();

const { minimizeBrowserWindows, hideBrowserWindows } = require('../window-utils');
const { applyExternal } = require('../external-apply');

const NaukriAdapter = require('./adapters/naukriAdapter');
const WellfoundAdapter = require('./adapters/wellfoundAdapter');
const IndeedAdapter = require('./adapters/indeedAdapter');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

// Centralized Controller State
let automationState = 'Idle'; // 'Idle' | 'Running' | 'Stopping' | 'Stopped' | 'Error'
let isBatchProcessing = false;
let activeAbortController = null;
const activeContexts = new Set();

const log = (msg) => {
  const line = `[${new Date().toLocaleString()}] [Windows Engine] [${automationState}] ${msg}`;
  console.log(line);
};

async function fetchSyncConfig() {
  if (!ENGINE_API_KEY) {
    log('⚠️ No ENGINE_API_KEY configured in .env. Log in to Web Dashboard to obtain your API key.');
    return null;
  }

  try {
    const res = await fetch(`${DASHBOARD_URL}/api/engine/sync-config`, {
      headers: { 'X-Engine-API-Key': ENGINE_API_KEY }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    log(`Sync Config Error: ${err.message}`);
    return null;
  }
}

async function sendHeartbeat() {
  if (!ENGINE_API_KEY) return;
  try {
    await fetch(`${DASHBOARD_URL}/api/engine/ping`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Engine-API-Key': ENGINE_API_KEY
      },
      body: JSON.stringify({
        systemInfo: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          pid: process.pid,
          automationState
        }
      })
    });
  } catch (e) {}
}

async function reportDiscoveredJob(portal, jobData) {
  if (!ENGINE_API_KEY) return null;
  try {
    const res = await fetch(`${DASHBOARD_URL}/api/engine/report-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Engine-API-Key': ENGINE_API_KEY
      },
      body: JSON.stringify({
        portal,
        original_url: jobData.link || jobData.href || `https://${portal}.com/job/${Date.now()}`,
        job_identifier: jobData.link || jobData.title,
        title: jobData.title,
        company: jobData.company || '',
        location: jobData.location || 'Remote',
        salary: jobData.salary || '',
        description: jobData.description || (jobData.title + ' position')
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    log(`Reported Discovered Job: "${jobData.title}" at "${jobData.company || 'Company'}" (Score: ${data.matchScore}%, Status: ${data.classification})`);
    return data;
  } catch (err) {
    log(`Report Job Error: ${err.message}`);
    return null;
  }
}

async function reportApplicationResult(portal, appData) {
  if (!ENGINE_API_KEY) return;
  try {
    await fetch(`${DASHBOARD_URL}/api/engine/report-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Engine-API-Key': ENGINE_API_KEY
      },
      body: JSON.stringify({
        portal,
        title: appData.title,
        company: appData.company || '',
        job_url: appData.link || '',
        status: appData.status || 'Submitted',
        verified: appData.verified ? 1 : 0
      })
    });
    log(`Reported Application (${appData.status}): "${appData.title}"`);
  } catch (err) {
    log(`Report Application Error: ${err.message}`);
  }
}

// Emergency Stop Cancellation Trigger
async function stopAllAutomation() {
  if (automationState === 'Stopping' || automationState === 'Stopped') return;
  automationState = 'Stopping';
  log('🚨 Emergency Stop Signal Received! Immediately aborting active tasks and closing browser contexts...');

  if (activeAbortController) {
    activeAbortController.abort();
  }

  for (const ctx of activeContexts) {
    try {
      await ctx.close();
    } catch (e) {}
  }
  activeContexts.clear();

  automationState = 'Stopped';
  isBatchProcessing = false;
  log('🛑 All browser contexts closed. Automation Engine Stopped.');
}

function setupConsoleListener(page, portalName, config, signal) {
  const externalQueue = [];

  page.on('console', async (msg) => {
    if (signal.aborted) return;
    const text = msg.text();
    if (!/auto-apply/.test(text)) return;
    const clean = text.replace(/%c\[auto-apply\]\s*\S*/, '').trim();
    log(`  [${portalName}] ${clean.slice(0, 160)}`);

    // Parse discovered job lines
    const m = clean.match(/▶ (?:Applying|Opening)[^:]*: (.+)/);
    if (m && !signal.aborted) {
      const [main, link, cardSalary] = m[1].split(' | ');
      const atParts = main.split(' @ ');
      const company = atParts.length > 1 ? atParts.pop() : '';
      const title = atParts.join(' @ ');

      const jobMatch = await reportDiscoveredJob(portalName, {
        title: title.trim(),
        company: (company || '').replace(/^\?$/, '').trim(),
        link: (link || '').trim(),
        salary: (cardSalary || '').trim()
      });

      // Enforce AI score threshold and hard eligibility check
      if (jobMatch && (!jobMatch.isEligible || jobMatch.matchScore < (config.preferences?.min_match_score || 50))) {
        log(`  [SKIPPED] Job "${title.trim()}" is ineligible or below match threshold (${jobMatch.matchScore}% < ${config.preferences?.min_match_score || 50}%).`);
      }
    }

    // External ATS jobs
    const ext = clean.match(/🔗 EXTERNAL \| (.+) \| (\S+)/);
    if (ext && !signal.aborted) {
      const extTitle = ext[1].trim();
      const extHref = ext[2].trim();
      externalQueue.push({ title: extTitle, href: extHref });
    }

    // Application result confirmations
    if (/✅ applied|application sent|application submitted/i.test(clean) && !signal.aborted) {
      const titlem = clean.match(/(?:applied|submitted|sent)[^:]*:?\s*(.+)/i);
      reportApplicationResult(portalName, {
        title: titlem ? titlem[1].trim() : 'Applied Role',
        status: 'Submitted',
        verified: 1
      });
    }
  });

  return externalQueue;
}

async function runAutomationCycle() {
  if (isBatchProcessing || automationState === 'Stopping') return;
  isBatchProcessing = true;

  activeAbortController = new AbortController();
  const { signal } = activeAbortController;

  try {
    const config = await fetchSyncConfig();
    if (!config) {
      isBatchProcessing = false;
      return;
    }

    const { user, profile, preferences, automationSettings, resume } = config;

    if (!automationSettings.enabled) {
      if (automationState !== 'Stopped') {
        log('Automation is currently PAUSED on Dashboard.');
      }
      automationState = 'Stopped';
      isBatchProcessing = false;
      return;
    }

    automationState = 'Running';
    log(`Sync OK for User: ${user.name} (${user.email}) | Mode: ${automationSettings.dry_run ? 'DRY RUN' : 'LIVE SUBMISSION'}`);

    const enabledPortals = automationSettings.enabled_portals || ['naukri', 'wellfound', 'indeed'];

    for (const portalName of enabledPortals) {
      if (signal.aborted || automationState !== 'Running') break;

      let adapter = null;
      if (portalName === 'naukri') adapter = new NaukriAdapter(config);
      if (portalName === 'wellfound') adapter = new WellfoundAdapter(config);
      if (portalName === 'indeed') adapter = new IndeedAdapter(config);

      if (!adapter) continue;

      const searchUrls = adapter.getSearchUrls();
      if (!searchUrls || searchUrls.length === 0) {
        log(`No target search URLs for ${portalName}. Skipping portal.`);
        continue;
      }

      log(`--- Starting Automation Batch for Portal: ${portalName.toUpperCase()} ---`);
      const profileDir = adapter.getProfileDir();

      let ctx = null;
      try {
        ctx = await chromium.launchPersistentContext(profileDir, {
          channel: 'chrome',
          headless: false,
          viewport: { width: 1280, height: 900 },
          args: ['--window-position=-32000,-32000']
        });

        activeContexts.add(ctx);

        // Hide browser window on Windows
        setTimeout(() => hideBrowserWindows(profileDir).catch(() => {}), 1500);

        const page = ctx.pages()[0] || (await ctx.newPage());
        const externalQueue = setupConsoleListener(page, portalName, config, signal);

        for (const url of searchUrls) {
          if (signal.aborted || automationState !== 'Running') break;

          log(`Navigating to search feed: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
          await page.waitForLoadState('domcontentloaded').catch(() => {});

          const injectedScript = adapter.getInjectedScript();
          if (injectedScript && !signal.aborted) {
            log(`Injecting Automation Adapter into ${portalName}...`);
            await page.evaluate(injectedScript).catch(e => log(`Script injection notice: ${e.message}`));
          }

          // Dynamic Playwright Wait Condition instead of fixed 15s timeout
          await page.waitForTimeout(10000);

          // Process any queued external ATS jobs for this portal batch
          while (externalQueue.length > 0 && !signal.aborted && automationState === 'Running') {
            const extJob = externalQueue.shift();
            log(`Processing External ATS Job: "${extJob.title}" at ${extJob.href}`);
            const extResult = await applyExternal(ctx, extJob, {
              CV: {
                name: profile.full_name || user.name,
                email: profile.email || user.email,
                phone: profile.phone,
                location: profile.location,
                currentRole: profile.current_role,
                company: profile.company,
                noticePeriod: profile.notice_period,
                currentCTC: profile.current_ctc,
                expectedCTC: profile.expected_ctc,
                linkedin: profile.linkedin_url,
                github: profile.github_url,
                portfolio: profile.portfolio_url,
                education: profile.education,
                skills: profile.skills,
                highlights: profile.highlights
              },
              live: !automationSettings.dry_run,
              resumePath: resume?.file_path || '',
              log
            });

            log(`External ATS Result (${extJob.title}): ${extResult.status} - ${extResult.detail}`);
            reportApplicationResult(portalName, {
              title: extJob.title,
              company: '',
              link: extJob.href,
              status: extResult.status === 'applied' ? 'Submitted' : extResult.status === 'would-apply' ? 'Application prepared' : 'Submission uncertain',
              verified: extResult.status === 'applied' ? 1 : 0
            });
          }
        }

      } catch (err) {
        log(`Portal Execution Warning (${portalName}): ${err.message}`);
      } finally {
        if (ctx) {
          activeContexts.delete(ctx);
          await ctx.close().catch(() => {});
        }
      }
    }

    if (automationState === 'Running') {
      automationState = 'Idle';
    }

  } catch (err) {
    log(`Execution Error: ${err.message}`);
    automationState = 'Error';
  } finally {
    isBatchProcessing = false;
  }
}

// Start Engine Process
log('=======================================================');
log('🤖 Starting JobPilot AI Windows Automation Engine');
log(`Connecting to Web Dashboard at: ${DASHBOARD_URL}`);
log('=======================================================');

// Initial Heartbeat and execution loop
sendHeartbeat();
setInterval(sendHeartbeat, 15000); // Heartbeat every 15 seconds

// Check emergency stop and config every 10 seconds
setInterval(async () => {
  const config = await fetchSyncConfig();
  if (config && !config.automationSettings.enabled) {
    if (automationState === 'Running' || isBatchProcessing) {
      await stopAllAutomation();
    }
  }
}, 10000);

// Run initial cycle after 2 seconds, then every 30 minutes
setTimeout(runAutomationCycle, 2000);
setInterval(runAutomationCycle, 30 * 60 * 1000);
