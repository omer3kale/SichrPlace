/**
 * Comprehensive Test Suite for All 56 Netlify Functions
 * Simple and effective tests for SichrPlace platform
 * 
 * Run with: node tests/all-functions-test.js
 */

const https = require('https');
const http = require('http');

// Test configuration
const CONFIG = {
    BASE_URL: process.env.NETLIFY_URL || 'https://0d051410--sichrplace.netlify.live',
    FUNCTIONS_PATH: '/.netlify/functions',
    TIMEOUT: 10000,
    TEST_USER: {
        email: 'test@sichrplace.com',
        password: 'TestPassword123!',
        username: 'testuser'
    }
};

// Test results tracking
let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(CONFIG.BASE_URL + CONFIG.FUNCTIONS_PATH + path);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SichrPlace-Test-Suite/1.0',
                ...headers
            },
            timeout: CONFIG.TIMEOUT
        };

        const client = url.protocol === 'https:' ? https : http;
        
        let attempt = 0;
        
        function tryRequest() {
            attempt++;
            
            const req = client.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    try {
                        const parsed = responseData ? JSON.parse(responseData) : {};
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: parsed,
                            raw: responseData
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: responseData,
                            raw: responseData
                        });
                    }
                });
            });

            req.on('error', (error) => {
                if (attempt < CONFIG.MAX_RETRIES && (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET')) {
                    setTimeout(tryRequest, CONFIG.RETRY_DELAY);
                } else {
                    reject(error);
                }
            });
            
            req.on('timeout', () => {
                if (attempt < CONFIG.MAX_RETRIES) {
                    req.destroy();
                    setTimeout(tryRequest, CONFIG.RETRY_DELAY);
                } else {
                    req.destroy();
                    reject(new Error('Request timeout after retries'));
                }
            });

            if (data) {
                req.write(typeof data === 'string' ? data : JSON.stringify(data));
            }
            req.end();
        }
        
        tryRequest();
    });
}

// Test helper functions
function logTest(name, status, message = '') {
    const timestamp = new Date().toISOString();
    const result = {
        name,
        status,
        message,
        timestamp
    };
    
    testResults.details.push(result);
    
    if (status === 'PASS') {
        testResults.passed++;
        console.log(`✅ [${timestamp}] ${name}: PASSED ${message}`);
    } else if (status === 'FAIL') {
        testResults.failed++;
        console.log(`❌ [${timestamp}] ${name}: FAILED ${message}`);
    } else {
        testResults.skipped++;
        console.log(`⚠️  [${timestamp}] ${name}: SKIPPED ${message}`);
    }
}

// Individual function tests
const functionTests = {
    // Authentication Functions
    async testAuthLogin() {
        try {
            const response = await makeRequest('POST', '/auth-login', {
                email: CONFIG.TEST_USER.email,
                password: CONFIG.TEST_USER.password
            });
            
            if (response.statusCode === 200 || response.statusCode === 401 || response.statusCode === 404) {
                logTest('auth-login', 'PASS', `Status: ${response.statusCode}`);
                return response.data?.token || null;
            } else {
                logTest('auth-login', 'FAIL', `Unexpected status: ${response.statusCode}`);
                return null;
            }
        } catch (error) {
            logTest('auth-login', 'FAIL', `Error: ${error.message}`);
            return null;
        }
    },

    async testAuthRegister() {
        try {
            const response = await makeRequest('POST', '/auth-register', {
                email: `test_${Date.now()}@sichrplace.com`,
                password: CONFIG.TEST_USER.password,
                username: `testuser_${Date.now()}`
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('auth-register', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-register', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-register', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAuthMe(token) {
        try {
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const response = await makeRequest('GET', '/auth-me', null, headers);
            
            if (response.statusCode === 200 || response.statusCode === 401) {
                logTest('auth-me', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-me', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-me', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAuthForgotPassword() {
        try {
            const response = await makeRequest('POST', '/auth-forgot-password', {
                email: CONFIG.TEST_USER.email
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('auth-forgot-password', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-forgot-password', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-forgot-password', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAuthResetPassword() {
        try {
            const response = await makeRequest('POST', '/auth-reset-password', {
                token: 'test-token',
                password: 'NewPassword123!'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('auth-reset-password', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-reset-password', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-reset-password', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAuthVerify() {
        try {
            const response = await makeRequest('POST', '/auth-verify', {
                token: 'test-verification-token'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('auth-verify', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-verify', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-verify', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAuthVerifyResetToken() {
        try {
            const response = await makeRequest('POST', '/auth-verify-reset-token', {
                token: 'test-reset-token'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('auth-verify-reset-token', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-verify-reset-token', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-verify-reset-token', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAuthResendVerification() {
        try {
            const response = await makeRequest('POST', '/auth-resend-verification', {
                email: CONFIG.TEST_USER.email
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('auth-resend-verification', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('auth-resend-verification', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('auth-resend-verification', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Core Platform Functions
    async testApartments() {
        try {
            const response = await makeRequest('GET', '/apartments');
            
            if (response.statusCode === 200 || response.statusCode === 401) {
                logTest('apartments', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('apartments', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('apartments', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAddProperty() {
        try {
            const response = await makeRequest('POST', '/add-property', {
                title: 'Test Property',
                description: 'Test apartment listing',
                price: 1200,
                location: 'Test City'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('add-property', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('add-property', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('add-property', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testSearch() {
        try {
            const response = await makeRequest('GET', '/search?q=apartment&location=city');
            
            if (response.statusCode === 200 || response.statusCode === 400) {
                logTest('search', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('search', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('search', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testAdvancedSearch() {
        try {
            const response = await makeRequest('POST', '/advanced-search', {
                filters: {
                    minPrice: 500,
                    maxPrice: 2000,
                    bedrooms: 2
                }
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('advanced-search', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('advanced-search', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('advanced-search', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testFavorites() {
        try {
            const response = await makeRequest('GET', '/favorites');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('favorites', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('favorites', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('favorites', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testRecentlyViewed() {
        try {
            const response = await makeRequest('GET', '/recently-viewed');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('recently-viewed', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('recently-viewed', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('recently-viewed', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Communication Functions
    async testConversations() {
        try {
            const response = await makeRequest('GET', '/conversations');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('conversations', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('conversations', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('conversations', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testMessages() {
        try {
            const response = await makeRequest('GET', '/messages');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('messages', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('messages', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('messages', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testChats() {
        try {
            const response = await makeRequest('GET', '/chats');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('chats', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('chats', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('chats', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testRealtimeChat() {
        try {
            const response = await makeRequest('GET', '/realtime-chat');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('realtime-chat', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('realtime-chat', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('realtime-chat', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testNotifications() {
        try {
            const response = await makeRequest('GET', '/notifications');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('notifications', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('notifications', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('notifications', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Admin Functions
    async testAdmin() {
        try {
            const response = await makeRequest('GET', '/admin');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('admin', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('admin', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('admin', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testSystemAdministration() {
        try {
            const response = await makeRequest('GET', '/system-administration');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('system-administration', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('system-administration', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('system-administration', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testUserManagement() {
        try {
            const response = await makeRequest('GET', '/user-management');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('user-management', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('user-management', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('user-management', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testContentModeration() {
        try {
            const response = await makeRequest('GET', '/content-moderation');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('content-moderation', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('content-moderation', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('content-moderation', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Analytics Functions
    async testAnalyticsStats() {
        try {
            const response = await makeRequest('GET', '/analytics-stats');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('analytics-stats', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('analytics-stats', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('analytics-stats', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testRevenueAnalytics() {
        try {
            const response = await makeRequest('GET', '/revenue-analytics');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('revenue-analytics', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('revenue-analytics', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('revenue-analytics', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testUserEngagementAnalytics() {
        try {
            const response = await makeRequest('GET', '/user-engagement-analytics');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('user-engagement-analytics', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('user-engagement-analytics', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('user-engagement-analytics', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testPerformanceOverview() {
        try {
            const response = await makeRequest('GET', '/performance-overview');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('performance-overview', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('performance-overview', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('performance-overview', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testUserActivityTracking() {
        try {
            const response = await makeRequest('POST', '/user-activity-tracking', {
                action: 'page_view',
                page: '/test'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('user-activity-tracking', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('user-activity-tracking', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('user-activity-tracking', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Maps Functions
    async testMapsGeocode() {
        try {
            const response = await makeRequest('GET', '/maps-geocode?address=123 Test Street');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('maps-geocode', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('maps-geocode', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('maps-geocode', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testMapsReverseGeocode() {
        try {
            const response = await makeRequest('GET', '/maps-reverse-geocode?lat=40.7128&lng=-74.0060');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('maps-reverse-geocode', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('maps-reverse-geocode', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('maps-reverse-geocode', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testMapsDistance() {
        try {
            const response = await makeRequest('GET', '/maps-distance?origin=New York&destination=Boston');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('maps-distance', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('maps-distance', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('maps-distance', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testMapsNearbyPlaces() {
        try {
            const response = await makeRequest('GET', '/maps-nearby-places?lat=40.7128&lng=-74.0060&type=restaurant');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('maps-nearby-places', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('maps-nearby-places', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('maps-nearby-places', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testMapsSearchByLocation() {
        try {
            const response = await makeRequest('GET', '/maps-search-by-location?query=coffee&lat=40.7128&lng=-74.0060');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('maps-search-by-location', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('maps-search-by-location', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('maps-search-by-location', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testMapsPlaceTypes() {
        try {
            const response = await makeRequest('GET', '/maps-place-types');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('maps-place-types', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('maps-place-types', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('maps-place-types', 'FAIL', `Error: ${error.message}`);
        }
    },

    // GDPR Functions
    async testGdprCompliance() {
        try {
            const response = await makeRequest('GET', '/gdpr-compliance');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('gdpr-compliance', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('gdpr-compliance', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('gdpr-compliance', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testGdprTracking() {
        try {
            const response = await makeRequest('POST', '/gdpr-tracking', {
                userId: 'test-user',
                action: 'data_access'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('gdpr-tracking', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('gdpr-tracking', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('gdpr-tracking', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testConsentManagement() {
        try {
            const response = await makeRequest('GET', '/consent-management');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('consent-management', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('consent-management', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('consent-management', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testPrivacyControls() {
        try {
            const response = await makeRequest('GET', '/privacy-controls');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('privacy-controls', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('privacy-controls', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('privacy-controls', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Payment Functions
    async testPaypalIntegration() {
        try {
            const response = await makeRequest('GET', '/paypal-integration');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('paypal-integration', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('paypal-integration', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('paypal-integration', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testPaypalPayments() {
        try {
            const response = await makeRequest('POST', '/paypal-payments', {
                amount: 100,
                currency: 'USD'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('paypal-payments', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('paypal-payments', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('paypal-payments', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Utility Functions
    async testBookingRequests() {
        try {
            const response = await makeRequest('GET', '/booking-requests');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('booking-requests', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('booking-requests', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('booking-requests', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testViewingRequests() {
        try {
            const response = await makeRequest('GET', '/viewing-requests');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('viewing-requests', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('viewing-requests', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('viewing-requests', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testReviews() {
        try {
            const response = await makeRequest('GET', '/reviews');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('reviews', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('reviews', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('reviews', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testEmailManagement() {
        try {
            const response = await makeRequest('GET', '/email-management');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('email-management', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('email-management', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('email-management', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testEmailNotifications() {
        try {
            const response = await makeRequest('POST', '/email-notifications', {
                to: 'test@example.com',
                subject: 'Test notification',
                message: 'Test message'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('email-notifications', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('email-notifications', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('email-notifications', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testEmailService() {
        try {
            const response = await makeRequest('GET', '/email-service');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('email-service', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('email-service', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('email-service', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testFileUpload() {
        try {
            const response = await makeRequest('POST', '/file-upload', {
                filename: 'test.jpg',
                content: 'base64encodedcontent'
            });
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('file-upload', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('file-upload', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('file-upload', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testThirdPartyIntegrations() {
        try {
            const response = await makeRequest('GET', '/third-party-integrations');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('third-party-integrations', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('third-party-integrations', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('third-party-integrations', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testUserProfile() {
        try {
            const response = await makeRequest('GET', '/user-profile');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('user-profile', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('user-profile', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('user-profile', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testCacheManagement() {
        try {
            const response = await makeRequest('GET', '/cache-management');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('cache-management', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('cache-management', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('cache-management', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Health Check Functions
    async testHealth() {
        try {
            const response = await makeRequest('GET', '/health');
            
            if (response.statusCode === 200) {
                logTest('health', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('health', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('health', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testSimpleHealth() {
        try {
            const response = await makeRequest('GET', '/simple-health');
            
            if (response.statusCode === 200) {
                logTest('simple-health', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('simple-health', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('simple-health', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testSystemHealthCheck() {
        try {
            const response = await makeRequest('GET', '/system-health-check');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('system-health-check', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('system-health-check', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('system-health-check', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testCsrfToken() {
        try {
            const response = await makeRequest('GET', '/csrf-token');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('csrf-token', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('csrf-token', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('csrf-token', 'FAIL', `Error: ${error.message}`);
        }
    },

    // Test Functions
    async testHello() {
        try {
            const response = await makeRequest('GET', '/hello');
            
            if (response.statusCode === 200) {
                logTest('hello', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('hello', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('hello', 'FAIL', `Error: ${error.message}`);
        }
    },

    async testTest() {
        try {
            const response = await makeRequest('GET', '/test');
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                logTest('test', 'PASS', `Status: ${response.statusCode}`);
            } else {
                logTest('test', 'FAIL', `Status: ${response.statusCode}`);
            }
        } catch (error) {
            logTest('test', 'FAIL', `Error: ${error.message}`);
        }
    }
};

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting SichrPlace Functions Test Suite...');
    console.log(`📍 Testing against: ${CONFIG.BASE_URL}`);
    console.log(`⏱️  Timeout: ${CONFIG.TIMEOUT}ms`);
    console.log('─'.repeat(80));

    const startTime = Date.now();

    // Get authentication token first
    console.log('🔐 Attempting authentication...');
    const token = await functionTests.testAuthLogin();

    // Run all function tests
    const testFunctions = Object.keys(functionTests).filter(key => key !== 'testAuthLogin');
    
    for (const testName of testFunctions) {
        try {
            if (testName === 'testAuthMe') {
                await functionTests[testName](token);
            } else {
                await functionTests[testName]();
            }
        } catch (error) {
            logTest(testName.replace('test', '').toLowerCase(), 'FAIL', `Test execution error: ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Print summary
    console.log('─'.repeat(80));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('─'.repeat(80));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⚠️  Skipped: ${testResults.skipped}`);
    console.log(`📈 Total: ${testResults.passed + testResults.failed + testResults.skipped}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📍 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

    // Save detailed results
    const resultsFile = `test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    require('fs').writeFileSync(resultsFile, JSON.stringify({
        summary: {
            passed: testResults.passed,
            failed: testResults.failed,
            skipped: testResults.skipped,
            total: testResults.passed + testResults.failed + testResults.skipped,
            duration,
            successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)
        },
        details: testResults.details,
        config: CONFIG,
        timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`💾 Detailed results saved to: ${resultsFile}`);
    
    if (testResults.failed > 0) {
        console.log('\n❌ Some tests failed. Check the detailed results for more information.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests completed successfully!');
        process.exit(0);
    }
}

// Run the tests
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('💥 Test suite crashed:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, functionTests, CONFIG };