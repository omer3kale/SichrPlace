// SichrPlace Frontend Configuration
// Production configuration for www.sichrplace.com

const CONFIG = {
    // Environment Detection
    ENVIRONMENT: window.location.hostname.includes('localhost') ? 'development' : 'production',
    
    // Domain Configuration
    PRODUCTION_URL: 'https://www.sichrplace.com',
    DEVELOPMENT_URL: 'https://sichrplace.netlify.app',
    
    // API Configuration
    get API_BASE_URL() {
        return this.ENVIRONMENT === 'production' ? this.PRODUCTION_URL : this.DEVELOPMENT_URL;
    },
    
    // Feature Flags
    FEATURES: {
        ANALYTICS: true,
        PAYPAL_INTEGRATION: true,
        GOOGLE_MAPS: true,
        REALTIME_CHAT: true,
        PWA: true,
        GDPR_COMPLIANCE: true
    },
    
    // Security Configuration
    SECURITY: {
        CSRF_PROTECTION: true,
        HTTPS_ONLY: true,
        SECURE_COOKIES: true
    },
    
    // PayPal Configuration
    PAYPAL: {
        CLIENT_ID: 'AUy9aONSQz8RAXaZdqaWWfUqUjVgXMQdMGK9HtPj8vl3LYKxZCCHDJlpRDKGWVOXM0p8vD2f9w_7yTuv',
        CURRENCY: 'EUR',
        ENVIRONMENT: 'sandbox' // Change to 'production' when ready
    },
    
    // Google Maps Configuration
    GOOGLE_MAPS: {
        API_KEY: 'AIzaSyA1234567890ABCDEFGHIJKLMNOPQRSTUVWX' // Replace with your actual key
    },
    
    // Application Metadata
    APP: {
        NAME: 'SichrPlace',
        VERSION: '1.0.0',
        DESCRIPTION: 'Secure Apartment Rental Platform',
        DOMAIN: 'www.sichrplace.com'
    }
};

// Utility function to get API endpoint
function getApiEndpoint(path) {
    return `${CONFIG.API_BASE_URL}/api${path}`;
}

// Utility function to check if in production
function isProduction() {
    return CONFIG.ENVIRONMENT === 'production';
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Make CONFIG available globally
window.SICHRPLACE_CONFIG = CONFIG;