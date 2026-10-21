/**
 * Naukri Portal Adapter - Refactored for Local Windows Engine
 */
const BasePortalAdapter = require('./baseAdapter');
const path = require('path');
const fs = require('fs');

class NaukriAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('naukri', engineConfig);
  }

  getProfileDir() {
    return path.join(__dirname, '../../.naukri-apply-profile');
  }

  getSearchUrls() {
    const roles = (this.engineConfig.preferences?.roles || ['Full Stack Developer']).map(r => encodeURIComponent(r.toLowerCase().replace(/\s+/g, '-')));
    return roles.map(r => `https://www.naukri.com/${r}-jobs?experience=1`);
  }

  getInjectedScript() {
    const scriptPath = path.join(__dirname, '../../naukri-auto-apply.js');
    if (!fs.existsSync(scriptPath)) return '';
    const raw = fs.readFileSync(scriptPath, 'utf8');

    // Inject configuration from Dashboard
    const cfg = {
      CV: {
        name: this.engineConfig.profile?.current_role ? this.engineConfig.user?.name : '',
        email: this.engineConfig.user?.email || '',
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
      try { ${raw} } catch(e) { console.error('Naukri adapter execution error:', e); }
    })()`;
  }
}

module.exports = NaukriAdapter;
