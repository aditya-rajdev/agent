/**
 * Wellfound Portal Adapter - Refactored for Local Windows Engine
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');
const fs = require('fs');

class WellfoundAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('wellfound', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.wellfound-chrome-profile');
  }

  getSearchUrls() {
    const configuredRoles = this.engineConfig.preferences?.roles || [];
    if (!Array.isArray(configuredRoles) || configuredRoles.length === 0) {
      console.warn('[WARN] [Wellfound] No target job roles configured in Job Preferences. Using default feed.');
      return ['https://wellfound.com/jobs'];
    }
    return [
      'https://wellfound.com/jobs',
      ...configuredRoles.map(r => `https://wellfound.com/role/r/${encodeURIComponent(String(r).trim().toLowerCase().replace(/\s+/g, '-'))}`)
    ];
  }

  getInjectedScript() {
    const scriptPath = path.join(__dirname, '../../wellfound-auto-apply.js');
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
      try { ${raw} } catch(e) { console.error('Wellfound adapter execution error:', e); }
    })()`;
  }
}

module.exports = WellfoundAdapter;
