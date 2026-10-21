/**
 * Internshala Portal Adapter - Internship Discovery & Assisted Application Workflow
 * Supported Capabilities:
 * - Internship discovery and category filtering (Tech, Web Dev, Mobile).
 * - Application preparation for internship screening questions.
 * - Live submission for permitted standard application forms.
 */
const BasePortalAdapter = require('./baseAdapter');

class InternshalaAdapter extends BasePortalAdapter {
  constructor(engineConfig) {
    super('internshala', engineConfig);
  }

  getSearchUrls() {
    return ['https://internshala.com/internships/matching-preference'];
  }

  getCapabilities() {
    return {
      discovery: true,
      detailRetrieval: true,
      applicationPreparation: true,
      liveAutomatedSubmission: true,
      verification: 'Form Closed Check'
    };
  }
}

module.exports = InternshalaAdapter;
