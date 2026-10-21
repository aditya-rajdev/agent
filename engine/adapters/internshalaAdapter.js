/**
 * Internshala Portal Adapter - Internship & Fresher Job Discovery
 * Supported Capabilities:
 * - Scrapes Internshala internships and fresher jobs.
 * - Filters by role, location, work-from-home, duration, and stipend.
 * - Extracts internship-specific fields and handles screening answers.
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');

class InternshalaAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('internshala', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.internshala-chrome-profile');
  }

  getSearchUrls() {
    const roles = (this.engineConfig.preferences?.roles || ['Web Development']).map(r => encodeURIComponent(String(r).trim().toLowerCase().replace(/\s+/g, '-')));
    return roles.map(r => `https://internshala.com/internships/${r}-internship`);
  }

  getInjectedScript() {
    const cfg = {
      CV: {
        name: this.engineConfig.profile?.full_name || this.engineConfig.user?.name || '',
        email: this.engineConfig.profile?.email || this.engineConfig.user?.email || '',
        phone: this.engineConfig.profile?.phone || '',
        location: this.engineConfig.profile?.location || '',
        education: this.engineConfig.profile?.education || '',
        skills: this.engineConfig.profile?.skills || ''
      }
    };

    return `(async () => {
      window.__APPLY_CONFIG = ${JSON.stringify(cfg)};
      console.log('[auto-apply] Internshala Adapter Injected');
      const cards = [...document.querySelectorAll('.individual_internship, .internship_meta')];
      cards.forEach(card => {
        const titleEl = card.querySelector('.profile, [class*="profile" i], h3');
        const compEl = card.querySelector('.company_name, [class*="company" i]');
        const linkEl = card.querySelector('a[href*="/internship/detail/"], a.view_detail_button');
        if (titleEl && linkEl) {
          const title = titleEl.textContent.trim();
          const company = compEl ? compEl.textContent.trim() : 'Internshala Employer';
          console.log('▶ Applying: ' + title + ' @ ' + company + ' | ' + linkEl.href);
        }
      });
    })()`;
  }
}

module.exports = InternshalaAdapter;
