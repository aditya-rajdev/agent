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

const NaukriAdapter = require('./adapters/naukriAdapter');
const WellfoundAdapter = require('./adapters/wellfoundAdapter');
const IndeedAdapter = require('./adapters/indeedAdapter');

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || '';

let isRunning = false;

const log = (msg) => {
  const line = `[${new Date().toLocaleString()}] [Windows Engine] ${msg}`;
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
          pid: process.pid
        }
      })
    });
  } catch (e) {}
}

async function reportDiscoveredJob(portal, jobData) {
  if (!ENGINE_API_KEY) return;
  try {
    await fetch(`${DASHBOARD_URL}/api/engine/report-job`, {
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
        description: jobData.title + ' position'
      })
    });
    log(`Reported Discovered Job: "${jobData.title}" at "${jobData.company || 'Company'}"`);
  } catch (err) {
    log(`Report Job Error: ${err.message}`);
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
        verified: appData.verified || 1
      })
    });
    log(`Reported Application (${appData.status}): "${appData.title}"`);
  } catch (err) {
    log(`Report Application Error: ${err.message}`);
  }
}

function setupConsoleListener(page, portalName) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (!/auto-apply/.test(text)) return;
    const clean = text.replace(/%c\[auto-apply\]\s*\S*/, '').trim();
    log(`  [${portalName}] ${clean.slice(0, 160)}`);

    // Parse discovered job lines: "▶ Applying: <title> | <href>" or "▶ Opening: <title>"
    const m = clean.match(/▶ (?:Applying|Opening)[^:]*: (.+)/);
    if (m) {
      const [main, link, cardSalary] = m[1].split(' | ');
      const atParts = main.split(' @ ');
      const company = atParts.length > 1 ? atParts.pop() : '';
      const title = atParts.join(' @ ');

      reportDiscoveredJob(portalName, {
        title: title.trim(),
        company: (company || '').replace(/^\?$/, '').trim(),
        link: (link || '').trim(),
        salary: (cardSalary || '').trim()
      });
    }

    // Parse application submission confirmation lines
    if (/✅ applied|application sent|application submitted/i.test(clean)) {
      const titlem = clean.match(/(?:applied|submitted|sent)[^:]*:?\s*(.+)/i);
      reportApplicationResult(portalName, {
        title: titlem ? titlem[1].trim() : 'Applied Role',
        status: 'Submitted',
        verified: 1
      });
    }
  });
}

async function runAutomationCycle() {
  if (isRunning) return;
  isRunning = true;

  try {
    const config = await fetchSyncConfig();
    if (!config) {
      isRunning = false;
      return;
    }

    const { user, profile, preferences, automationSettings } = config;

    if (!automationSettings.enabled) {
      log('Automation is currently PAUSED on Dashboard.');
      isRunning = false;
      return;
    }

    log(`Sync OK for User: ${user.name} (${user.email}) | Mode: ${automationSettings.dry_run ? 'DRY RUN' : 'LIVE SUBMISSION'}`);

    const enabledPortals = automationSettings.enabled_portals || ['naukri', 'wellfound', 'indeed'];

    for (const portalName of enabledPortals) {
      let adapter = null;
      if (portalName === 'naukri') adapter = new NaukriAdapter(config);
      if (portalName === 'wellfound') adapter = new WellfoundAdapter(config);
      if (portalName === 'indeed') adapter = new IndeedAdapter(config);

      if (!adapter) continue;

      log(`--- Starting Automation Batch for Portal: ${portalName.toUpperCase()} ---`);

      const profileDir = adapter.getProfileDir();
      const searchUrls = adapter.getSearchUrls();

      let ctx = null;
      try {
        ctx = await chromium.launchPersistentContext(profileDir, {
          channel: 'chrome',
          headless: false,
          viewport: { width: 1280, height: 900 },
          args: [
            '--window-position=-32000,-32000'
          ]
        });

        // Hide browser window on Windows
        setTimeout(() => hideBrowserWindows(profileDir).catch(() => {}), 1500);

        ctx.on('page', (p) => setupConsoleListener(p, portalName));

        const page = ctx.pages()[0] || (await ctx.newPage());
        setupConsoleListener(page, portalName);

        for (const url of searchUrls) {
          log(`Navigating to search feed: ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
          await page.waitForTimeout(5000);

          const injectedScript = adapter.getInjectedScript();
          if (injectedScript) {
            log(`Injecting Automation Adapter into ${portalName}...`);
            await page.evaluate(injectedScript).catch(e => log(`Script injection notice: ${e.message}`));
          }

          await page.waitForTimeout(15000);
        }

      } catch (err) {
        log(`Portal Error (${portalName}): ${err.message}`);
      } finally {
        if (ctx) await ctx.close().catch(() => {});
      }
    }

  } catch (err) {
    log(`Execution Error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

// Start Engine Process
log('=======================================================');
log('🤖 Starting JobPilot AI Windows Automation Engine');
log(`Connecting to Web Dashboard at: ${DASHBOARD_URL}`);
log('=======================================================');

// Initial Heartbeat and execution loop
sendHeartbeat();
setInterval(sendHeartbeat, 30000); // Heartbeat every 30 seconds

// Run initial cycle after 2 seconds, then every 30 minutes
setTimeout(runAutomationCycle, 2000);
setInterval(runAutomationCycle, 30 * 60 * 1000);
