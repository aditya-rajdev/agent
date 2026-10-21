/**
 * LinkedIn Portal Adapter - Assisted Application Workflow
 * Supported Capabilities:
 * - Permitted job discovery via public job feed / authorized integration.
 * - Application preparation: Generates structured candidate answers & cover letter.
 * - Assisted workflow: Direct link handoff to original application flow for safe user submission.
 */
const BasePortalAdapter = require('./baseAdapter');

class LinkedInAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('linkedin', engineConfig);
  }

  getSearchUrls() {
    const roles = (this.engineConfig.preferences?.roles || ['Full Stack Developer']).map(r => encodeURIComponent(r));
    return roles.map(r => `https://www.linkedin.com/jobs/search/?keywords=${r}`);
  }

  getCapabilities() {
    return {
      discovery: true,
      detailRetrieval: true,
      applicationPreparation: true,
      liveAutomatedSubmission: false, // Assisted application workflow
      verification: 'Assisted'
    };
  }
}

module.exports = LinkedInAdapter;
