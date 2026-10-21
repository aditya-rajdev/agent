/**
 * Base Portal Adapter Interface
 * Every job portal adapter (Naukri, Wellfound, Indeed, External ATS) implements this common contract.
 */
class BasePortalAdapter {
  constructor(portalName, engineConfig) {
    this.portalName = portalName;
    this.engineConfig = engineConfig;
  }

  async runDiscovery(page) {
    throw new Error('runDiscovery() must be implemented by subclass');
  }

  async runApplication(page, job) {
    throw new Error('runApplication() must be implemented by subclass');
  }

  async verifySubmission(page, job) {
    return 'unknown';
  }
}

module.exports = BasePortalAdapter;
