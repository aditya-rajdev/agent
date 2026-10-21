/**
 * LinkedIn Portal Adapter
 * Supported Capabilities:
 * - Job discovery & detail extraction from public search feed.
 * - Distinguishes Easy Apply listings from external company redirects.
 * - Candidate profile mapping & form preparation.
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');
const fs = require('fs');

class LinkedInAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('linkedin', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.linkedin-chrome-profile');
  }

  getSearchUrls() {
    const configuredRoles = this.engineConfig.preferences?.roles || [];
    if (!Array.isArray(configuredRoles) || configuredRoles.length === 0) {
      console.warn('[WARN] [LinkedIn] No target job roles configured in Job Preferences.');
      return ['https://www.linkedin.com/jobs/search/?keywords=Software%20Engineer'];
    }
    return configuredRoles.map(r => `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(String(r).trim())}`);
  }

  getInjectedScript() {
    const cfg = {
      CV: {
        name: this.engineConfig.profile?.full_name || this.engineConfig.user?.name || '',
        email: this.engineConfig.profile?.email || this.engineConfig.user?.email || '',
        phone: this.engineConfig.profile?.phone || '',
        location: this.engineConfig.profile?.location || '',
        currentRole: this.engineConfig.profile?.current_role || '',
        company: this.engineConfig.profile?.company || '',
        skills: this.engineConfig.profile?.skills || ''
      }
    };

    return `(async () => {
      window.__APPLY_CONFIG = ${JSON.stringify(cfg)};
      console.log('[auto-apply] LinkedIn Adapter Injected');
      const cards = [...document.querySelectorAll('.job-card-container, .jobs-search-results__list-item, li.jobs-search-results__list-item')];
      cards.forEach(card => {
        const titleEl = card.querySelector('.job-card-list__title, a.job-card-container__link');
        const compEl = card.querySelector('.job-card-container__primary-description, .job-card-container__company-name');
        const locEl = card.querySelector('.job-card-container__metadata-item');
        if (titleEl) {
          const title = titleEl.textContent.trim();
          const company = compEl ? compEl.textContent.trim() : 'LinkedIn Hiring Company';
          const link = titleEl.href || location.href;
          const isEasyApply = !!card.querySelector('[aria-label*="Easy Apply" i], .job-card-container__apply-method');
          console.log('▶ Applying: ' + title + ' @ ' + company + ' | ' + link + (isEasyApply ? ' [Easy Apply]' : ''));
        }
      });
    })()`;
  }
}

module.exports = LinkedInAdapter;
