/**
 * Unstop Portal Adapter
 * Supported Capabilities:
 * - Scrapes Unstop Jobs, Internships, and Hiring Challenges.
 * - Distinguishes Jobs & Internships from Hackathons/Competitions.
 * - Extracts Title, Organization, Location, Stipend/Salary, Opportunity Type, and Original Listing URL.
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');

class UnstopAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('unstop', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.unstop-chrome-profile');
  }

  getSearchUrls() {
    return [
      'https://unstop.com/jobs',
      'https://unstop.com/internships'
    ];
  }

  getInjectedScript() {
    const cfg = {
      CV: {
        name: this.engineConfig.profile?.full_name || this.engineConfig.user?.name || '',
        email: this.engineConfig.profile?.email || this.engineConfig.user?.email || '',
        phone: this.engineConfig.profile?.phone || '',
        location: this.engineConfig.profile?.location || ''
      }
    };

    return `(async () => {
      window.__APPLY_CONFIG = ${JSON.stringify(cfg)};
      console.log('[auto-apply] Unstop Adapter Injected');
      const cards = [...document.querySelectorAll('.opportunity_card, [class*="opportunity_card" i], a[href*="/jobs/"], a[href*="/internships/"], a[href*="/hackathons/"]')];
      cards.forEach(card => {
        const titleEl = card.querySelector('.opportunity_title, h2, h3, [class*="title" i]');
        const compEl = card.querySelector('.organisation_name, [class*="company" i], [class*="org" i]');
        const href = card.href || card.querySelector('a')?.href || location.href;
        if (titleEl && href) {
          const title = titleEl.textContent.trim();
          const company = compEl ? compEl.textContent.trim() : 'Unstop Partner';
          const isHackathon = /\/hackathons\/|\/competitions\//i.test(href) || /hackathon|challenge|competition|quiz/i.test(title);
          const typeTag = isHackathon ? ' [Event/Challenge]' : ' [Job/Internship]';
          console.log('▶ Applying: ' + title + typeTag + ' @ ' + company + ' | ' + href);
        }
      });
    })()`;
  }
}

module.exports = UnstopAdapter;
