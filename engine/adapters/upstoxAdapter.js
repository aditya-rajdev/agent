/**
 * Upstox Careers Adapter
 * Supported Capabilities:
 * - Scrapes official Upstox engineering & corporate career opportunities from https://upstox.com/careers/
 * - Extracts Job Title, Organization ("Upstox"), Location, Work Mode, and Lever/Greenhouse ATS links.
 * - Hands off form filling to external ATS engine or prepares candidate application.
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');

class UpstoxAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('upstox', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.upstox-chrome-profile');
  }

  getSearchUrls() {
    return ['https://upstox.com/careers/'];
  }

  getInjectedScript() {
    const cfg = {
      CV: {
        name: this.engineConfig.profile?.full_name || this.engineConfig.user?.name || '',
        email: this.engineConfig.profile?.email || this.engineConfig.user?.email || '',
        phone: this.engineConfig.profile?.phone || '',
        location: this.engineConfig.profile?.location || '',
        currentRole: this.engineConfig.profile?.current_role || '',
        company: this.engineConfig.profile?.company || ''
      }
    };

    return `(async () => {
      window.__APPLY_CONFIG = ${JSON.stringify(cfg)};
      console.log('[auto-apply] Upstox Careers Adapter Injected');
      const links = [...document.querySelectorAll('a[href*="jobs.lever.co"], a[href*="boards.greenhouse.io"], a[href*="/careers/"]')];
      links.forEach(link => {
        const title = link.textContent.trim() || 'Software Engineer';
        if (title.length > 3 && !/careers|about|home|privacy/i.test(title)) {
          console.log('▶ Applying: ' + title + ' @ Upstox | ' + link.href);
          console.log('🔗 EXTERNAL | ' + title + ' | ' + link.href);
        }
      });
    })()`;
  }
}

module.exports = UpstoxAdapter;
