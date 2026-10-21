/**
 * Indeed Portal Adapter - Refactored for Local Windows Engine
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');
const fs = require('fs');

class IndeedAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('indeed', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.indeed-chrome-profile');
  }

  getSearchUrls() {
    const configuredRoles = this.engineConfig.preferences?.roles || [];
    if (!Array.isArray(configuredRoles) || configuredRoles.length === 0) {
      console.warn('[WARN] [Indeed] No target job roles configured in Job Preferences. Skipping Indeed search.');
      return [];
    }
    return configuredRoles.map(r => {
      const query = encodeURIComponent(String(r).trim().toLowerCase());
      return `https://in.indeed.com/jobs?q=${query}&sort=date&fromage=14`;
    });
  }

  getInjectedScript() {
    const scriptPath = path.join(__dirname, '../../indeed-auto-apply.js');
    if (!fs.existsSync(scriptPath)) return '';
    const raw = fs.readFileSync(scriptPath, 'utf8');

    const cfg = {
      CV: {
        name: this.engineConfig.profile?.full_name || this.engineConfig.user?.name || '',
        email: this.engineConfig.profile?.email || this.engineConfig.user?.email || '',
        phone: this.engineConfig.profile?.phone || '',
        location: this.engineConfig.profile?.location || '',
        currentRole: this.engineConfig.profile?.current_role || '',
        company: this.engineConfig.profile?.company || '',
        education: this.engineConfig.profile?.education || '',
        yearsOfExperience: this.engineConfig.profile?.years_experience || '1',
        skills: this.engineConfig.profile?.skills || '',
        highlights: this.engineConfig.profile?.highlights || [],
        noticePeriod: this.engineConfig.profile?.notice_period || '30 days',
        currentCTC: this.engineConfig.profile?.current_ctc || '0',
        expectedCTC: this.engineConfig.profile?.expected_ctc || '0',
        github: this.engineConfig.profile?.github_url || '',
        linkedin: this.engineConfig.profile?.linkedin_url || '',
        portfolio: this.engineConfig.profile?.portfolio_url || ''
      },
      geminiKey: this.engineConfig.geminiKey || ''
    };

    return `(async () => {
      window.__APPLY_CONFIG = ${JSON.stringify(cfg)};
      try { ${raw} } catch(e) { console.error('Indeed adapter execution error:', e); }
    })()`;
  }
}

module.exports = IndeedAdapter;
