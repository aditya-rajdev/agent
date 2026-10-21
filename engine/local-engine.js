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

        const page = ctx.pages()[0] || (await ctx.newPage());

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

// Run initial cycle after 5 seconds, then every 30 minutes
setTimeout(runAutomationCycle, 5000);
setInterval(runAutomationCycle, 30 * 60 * 1000);
