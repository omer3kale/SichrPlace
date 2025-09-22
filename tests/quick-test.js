/**
 * Quick Test Script for SichrPlace Functions
 * Tests only the most critical functions for rapid feedback
 */

const https = require('https');
const http = require('http');

const CONFIG = {
    BASE_URL: process.env.NETLIFY_URL || 'http://localhost:8888',
    FUNCTIONS_PATH: '/.netlify/functions',
    TIMEOUT: 15000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 2000
};

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(CONFIG.BASE_URL + CONFIG.FUNCTIONS_PATH + path);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname + url.search,
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'SichrPlace-Test/1.0'
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
                res.on('end', () => resolve({
                    statusCode: res.statusCode,
                    data: responseData
                }));
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

            if (data) req.write(JSON.stringify(data));
            req.end();
        }
        
        tryRequest();
    });
}

async function quickTest() {
    console.log('🚀 Running Quick Health Check for SichrPlace Functions...');
    console.log(`📍 Testing: ${CONFIG.BASE_URL}`);
    console.log('─'.repeat(50));

    const tests = [
        { name: 'Health Check', path: '/health' },
        { name: 'Simple Health', path: '/simple-health' },
        { name: 'Hello Function', path: '/hello' },
        { name: 'CSRF Token', path: '/csrf-token' },
        { name: 'Apartments List', path: '/apartments' },
        { name: 'Auth Me', path: '/auth-me' }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
        try {
            const result = await makeRequest('GET', test.path);
            if (result.statusCode < 500) {
                console.log(`✅ ${test.name}: PASS (${result.statusCode})`);
                passed++;
            } else {
                console.log(`❌ ${test.name}: FAIL (${result.statusCode})`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ ${test.name}: ERROR (${error.message || error.code || 'Unknown error'})`);
            console.log(`   Details: ${error.stack ? error.stack.split('\n')[0] : JSON.stringify(error)}`);
            failed++;
        }
    }

    console.log('─'.repeat(50));
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);
    console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
        console.log('🎉 All quick tests passed!');
    } else {
        console.log('⚠️  Some tests failed. Run full test suite for details.');
    }
}

if (require.main === module) {
    quickTest().catch(console.error);
}

module.exports = { quickTest };