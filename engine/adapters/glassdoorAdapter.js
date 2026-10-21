/**
 * Glassdoor Portal Adapter - Job Discovery & Handoff
 * Supported Capabilities:
 * - Job discovery & detail retrieval via public feed.
 * - Application preparation: Candidate answer bank mapping.
 * - Assisted workflow: Direct handoff to company site / original apply page.
 */
const BasePortalAdapter = require('./baseAdapter');

class GlassdoorAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('glassdoor', engineConfig);
  }

  getSearchUrls() {
    const roles = (this.engineConfig.preferences?.roles || ['Software Engineer']).map(r => encodeURIComponent(r));
    return roles.map(r => `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${r}`);
  }

  getCapabilities() {
    return {
      discovery: true,
      detailRetrieval: true,
      applicationPreparation: true,
      liveAutomatedSubmission: false, // Handoff to external ATS
      verification: 'Handoff'
    };
  }
}

module.exports = GlassdoorAdapter;
