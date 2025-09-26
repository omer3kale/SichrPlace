// Quick security test for deployed Netlify site
import https from 'https';

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bright: '\x1b[1m'
};

console.log(`${colors.bright}${colors.cyan}🛡️ TESTING PRODUCTION SECURITY${colors.reset}`);
console.log('=' * 60);

async function testSecurityHeaders(url) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname,
            method: 'GET'
        };

        const req = https.request(options, (res) => {
            console.log(`\n${colors.blue}Testing: ${url}${colors.reset}`);
            console.log(`Status: ${res.statusCode}`);
            
            // Check important security headers
            const securityHeaders = {
                'strict-transport-security': 'HSTS',
                'content-security-policy': 'CSP',
                'x-frame-options': 'Frame Options',
                'x-content-type-options': 'Content Type Options',
                'referrer-policy': 'Referrer Policy',
                'permissions-policy': 'Permissions Policy'
            };

            let secureHeaders = 0;
            let totalHeaders = Object.keys(securityHeaders).length;

            console.log(`\n${colors.yellow}Security Headers:${colors.reset}`);
            for (const [header, name] of Object.entries(securityHeaders)) {
                const value = res.headers[header];
                if (value) {
                    console.log(`${colors.green}✅ ${name}: ${value}${colors.reset}`);
                    secureHeaders++;
                } else {
                    console.log(`${colors.red}❌ ${name}: Missing${colors.reset}`);
                }
            }

            const score = Math.round((secureHeaders / totalHeaders) * 100);
            console.log(`\n${colors.bright}Security Score: ${score}%${colors.reset}`);
            
            if (score >= 80) {
                console.log(`${colors.green}🎉 Excellent security configuration!${colors.reset}`);
            } else if (score >= 60) {
                console.log(`${colors.yellow}⚠️ Good security, room for improvement${colors.reset}`);
            } else {
                console.log(`${colors.red}⚠️ Security needs attention${colors.reset}`);
            }

            resolve(score);
        });

        req.on('error', (err) => {
            console.log(`${colors.red}❌ Error: ${err.message}${colors.reset}`);
            resolve(0);
        });

        req.end();
    });
}

async function main() {
    // Test your deployed site
    const netlifyUrl = 'https://sichrplace.netlify.app/';
    
    try {
        await testSecurityHeaders(netlifyUrl);
        
        console.log(`\n${colors.bright}${colors.cyan}🔗 Next Steps:${colors.reset}`);
        console.log(`1. Go to Netlify Dashboard: https://app.netlify.com/projects/sichrplace`);
        console.log(`2. Domain Settings → Add custom domain`);
        console.log(`3. Add: www.sichrplace.com and sichrplace.com`);
        console.log(`4. Configure DNS records with your domain provider`);
        console.log(`5. Enable HTTPS (automatic with Netlify)`);
        
    } catch (error) {
        console.log(`${colors.red}Error testing site: ${error.message}${colors.reset}`);
    }
}

main().catch(console.error);