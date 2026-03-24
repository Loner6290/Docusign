const geoip = require('geoip-lite');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

class BotMother {
  constructor() {
    this.LICENSE_KEY = "";
    this.TEST_MODE = false;
    this.EXIT_LINK = "https://google.com";
    this.GEOS = "";
    this.AGENTS_BLACKLIST_FILE = path.join(__dirname, '../data/AGENTS.txt');
    this.IPS_BLACKLIST_FILE = path.join(__dirname, '../data/IPS.txt');
    this.IPS_RANGE_BLACKLIST_FILE = path.join(__dirname, '../data/IPS_RANGE.txt');
    this.LOGS = path.join(__dirname, '../logs/bots_log.txt');
    this.VISITS = path.join(__dirname, '../logs/visits_log.txt');
    this.USER_AGENT = "";
    this.USER_IP = "";
  }

  setUserAgent(userAgent) {
    this.USER_AGENT = userAgent;
  }

  setUserIP(ip) {
    this.USER_IP = ip;
  }

  setExitLink(link) {
    this.EXIT_LINK = link;
  }

  setGeoFilter(geos) {
    this.GEOS = geos;
  }

  setTestMode(mode) {
    this.TEST_MODE = mode;
  }

  async getIpInfo(field) {
    try {
      if (this.TEST_MODE) {
        return field === 'countryCode' ? 'US' : false;
      }

      // Try geoip-lite first (faster, offline)
      const geo = geoip.lookup(this.USER_IP);
      if (geo && field === 'countryCode') {
        return geo.country;
      }

      // Fallback to online API for proxy/hosting detection
      const response = await axios.get(
        `http://ip-api.com/json/${this.USER_IP}?fields=status,country,countryCode,proxy,hosting`,
        { timeout: 5000 }
      );
      
      if (response.data && response.data.status === 'success') {
        return response.data[field];
      }
    } catch (error) {
      console.error('IP info lookup failed:', error.message);
    }
    return false;
  }

  async saveLog(message) {
    try {
      await fs.ensureDir(path.dirname(this.LOGS));
      await fs.appendFile(this.LOGS, `${new Date().toISOString()} - ${message}\n`);
    } catch (error) {
      console.error('Failed to save log:', error);
    }
  }

  async saveVisit() {
    try {
      const country = await this.getIpInfo('countryCode') || 'Unknown';
      const message = `Visit from [${this.USER_IP} - ${country}]\n`;
      
      await fs.ensureDir(path.dirname(this.VISITS));
      await fs.appendFile(this.VISITS, `${new Date().toISOString()} - ${message}`);
    } catch (error) {
      console.error('Failed to save visit:', error);
    }
  }

  async loadBlacklist(filename) {
    try {
      const content = await fs.readFile(filename, 'utf8');
      return content.split(',').map(item => item.trim()).filter(item => item);
    } catch (error) {
      console.error(`Failed to load blacklist ${filename}:`, error.message);
      return [];
    }
  }

  async geoFilter() {
    if (!this.GEOS.trim()) return true;

    const allowedCountries = this.GEOS.split(',').map(c => c.trim().toUpperCase());
    const userCountry = await this.getIpInfo('countryCode');
    
    if (userCountry && !allowedCountries.includes(userCountry.toUpperCase())) {
      await this.saveLog(`Geo filter blocked: ${this.USER_IP} from ${userCountry}`);
      return false;
    }
    return true;
  }

  async blockByAgents() {
    const agents = await this.loadBlacklist(this.AGENTS_BLACKLIST_FILE);
    const userAgent = this.USER_AGENT.toLowerCase();
    
    for (const agent of agents) {
      if (userAgent.includes(agent.toLowerCase())) {
        await this.saveLog(`Blocked by user agent: ${this.USER_IP} - ${agent}`);
        return false;
      }
    }
    return true;
  }

  async blockByIps() {
    const ips = await this.loadBlacklist(this.IPS_BLACKLIST_FILE);
    
    if (ips.includes(this.USER_IP)) {
      await this.saveLog(`Blocked by IP blacklist: ${this.USER_IP}`);
      return false;
    }
    return true;
  }

  async blockByIpsRange() {
    const ipRanges = await this.loadBlacklist(this.IPS_RANGE_BLACKLIST_FILE);
    
    for (const range of ipRanges) {
      if (this.USER_IP.startsWith(range)) {
        await this.saveLog(`Blocked by IP range: ${this.USER_IP} matches ${range}`);
        return false;
      }
    }
    return true;
  }

  async blockProxy() {
    const isProxy = await this.getIpInfo('proxy');
    const isHosting = await this.getIpInfo('hosting');
    
    if (isProxy || isHosting) {
      await this.saveLog(`Blocked proxy/hosting: ${this.USER_IP}`);
      return false;
    }
    return true;
  }

  async run(blockProxy = false) {
    if (this.TEST_MODE) {
      await this.saveVisit();
      return true;
    }

    // Save visit
    await this.saveVisit();

    // Run all checks
    const checks = [
      this.geoFilter(),
      this.blockByAgents(),
      this.blockByIps(),
      this.blockByIpsRange()
    ];

    if (blockProxy) {
      checks.push(this.blockProxy());
    }

    const results = await Promise.all(checks);
    return results.every(result => result === true);
  }
}

module.exports = BotMother;