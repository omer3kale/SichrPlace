// Domain Security Monitor for www.sichrplace.com
// Comprehensive security and performance monitoring script

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL, pathToFileURL } from 'url';

const DOMAIN = 'www.sichrplace.com';
const BACKUP_DOMAIN = 'sichrplace.netlify.app';

// Security headers to check
const REQUIRED_HEADERS = [
  'strict-transport-security',
  'x-frame-options',
  'x-xss-protection',
  'x-content-type-options',
  'content-security-policy',
  'referrer-policy'
];

// Test endpoints to verify
const TEST_ENDPOINTS = [
  '/',
  '/api/health',
  '/api/simple-health',
  '/api/property-statistics',
  '/api/user-profile',
  '/api/financial-management',
  '/api/ai-machine-learning'
];

class DomainSecurityMonitor {
  constructor() {
    this.results = {
      domain: DOMAIN,
      timestamp: new Date().toISOString(),
      overall_status: 'checking',
      ssl_status: 'unknown',
      security_headers: {},
      redirects: {},
      performance: {},
      endpoints: {},
      recommendations: []
    };
  }

  // Check SSL certificate
  async checkSSL(domain) {
    return new Promise((resolve) => {
      const options = {
        hostname: domain,
        port: 443,
        method: 'HEAD',
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        const now = new Date();
        const expiry = new Date(cert.valid_to);
        const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        resolve({
          valid: res.socket.authorized,
          issuer: cert.issuer?.CN || 'Unknown',
          expires: cert.valid_to,
          days_until_expiry: daysUntilExpiry,
          subject: cert.subject?.CN || domain,
          protocol: res.socket.getProtocol()
        });
      });

      req.on('error', () => {
        resolve({
          valid: false,
          error: 'SSL connection failed'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          valid: false,
          error: 'SSL check timeout'
        });
      });

      req.end();
    });
  }

  // Check security headers
  async checkSecurityHeaders(domain) {
    return new Promise((resolve) => {
      const options = {
        hostname: domain,
        port: 443,
        path: '/',
        method: 'HEAD',
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        const headers = {};
        let score = 0;

        REQUIRED_HEADERS.forEach(header => {
          const value = res.headers[header];
          headers[header] = {
            present: !!value,
            value: value || null
          };

          if (value) {
            score += this.scoreHeader(header, value);
          }
        });

        resolve({
          headers,
          score: Math.min(100, score),
          grade: this.getSecurityGrade(score)
        });
      });

      req.on('error', () => {
        resolve({
          headers: {},
          score: 0,
          grade: 'F',
          error: 'Failed to check headers'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          headers: {},
          score: 0,
          grade: 'F',
          error: 'Header check timeout'
        });
      });

      req.end();
    });
  }

  // Score individual headers
  scoreHeader(header, value) {
    const scores = {
      'strict-transport-security': value.includes('max-age') ? 20 : 10,
      'x-frame-options': value.toUpperCase() === 'DENY' ? 15 : 10,
      'x-xss-protection': value.includes('1') ? 10 : 5,
      'x-content-type-options': value === 'nosniff' ? 15 : 5,
      'content-security-policy': value.length > 50 ? 25 : 15,
      'referrer-policy': value.includes('strict') ? 15 : 10
    };
    return scores[header] || 5;
  }

  // Get security grade
  getSecurityGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  // Check redirects
  async checkRedirects() {
    const redirectTests = [
      { from: `http://${DOMAIN.replace('www.', '')}`, expected: `https://${DOMAIN}` },
      { from: `https://${DOMAIN.replace('www.', '')}`, expected: `https://${DOMAIN}` },
      { from: `http://${DOMAIN}`, expected: `https://${DOMAIN}` }
    ];

    const results = {};

    for (const test of redirectTests) {
      try {
        const url = new URL(test.from);
        const result = await this.followRedirect(url.hostname, url.pathname, url.protocol === 'https:');
        results[test.from] = {
          status: result.status,
          location: result.location,
          correct: result.location === test.expected,
          https: result.location?.startsWith('https://') || false
        };
      } catch (error) {
        results[test.from] = {
          status: 'error',
          error: error.message
        };
      }
    }

    return results;
  }

  // Follow a redirect
  async followRedirect(hostname, path = '/', isHttps = false) {
    return new Promise((resolve) => {
      const transport = isHttps ? https : http;
      const port = isHttps ? 443 : 80;

      const options = {
        hostname,
        port,
        path,
        method: 'HEAD',
        timeout: 10000
      };

  const req = transport.request(options, (res) => {
        resolve({
          status: res.statusCode,
          location: res.headers.location || `${isHttps ? 'https' : 'http'}://${hostname}${path}`
        });
      });

      req.on('error', () => {
        resolve({
          status: 'error',
          location: null
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'timeout',
          location: null
        });
      });

      req.end();
    });
  }

  // Check endpoint performance
  async checkEndpoint(endpoint) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const url = `https://${DOMAIN}${endpoint}`;

      const options = {
        hostname: DOMAIN,
        port: 443,
        path: endpoint,
        method: 'GET',
        timeout: 15000,
        headers: {
          'User-Agent': 'SichrPlace-Security-Monitor/1.0'
        }
      };

      const req = https.request(options, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode,
            response_time: responseTime,
            size: data.length,
            success: res.statusCode >= 200 && res.statusCode < 400,
            headers: res.headers
          });
        });
      });

      req.on('error', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          status: 'error',
          response_time: responseTime,
          success: false,
          error: 'Connection failed'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'timeout',
          response_time: 15000,
          success: false,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  // Generate recommendations
  generateRecommendations() {
    const recommendations = [];

    // SSL recommendations
    if (!this.results.ssl_status.valid) {
      recommendations.push({
        priority: 'high',
        category: 'ssl',
        message: 'SSL certificate is invalid or expired. Renew immediately.',
        action: 'Contact Netlify support or check DNS configuration'
      });
    } else if (this.results.ssl_status.days_until_expiry < 30) {
      recommendations.push({
        priority: 'medium',
        category: 'ssl',
        message: `SSL certificate expires in ${this.results.ssl_status.days_until_expiry} days`,
        action: 'Monitor for auto-renewal or prepare manual renewal'
      });
    }

    // Security headers recommendations
    if (this.results.security_headers.score < 80) {
      recommendations.push({
        priority: 'high',
        category: 'security',
        message: `Security headers score is ${this.results.security_headers.score}/100 (Grade: ${this.results.security_headers.grade})`,
        action: 'Review and enhance security headers in netlify.toml'
      });
    }

    // Performance recommendations
    const slowEndpoints = Object.entries(this.results.endpoints).filter(([_, data]) => 
      data.response_time > 5000
    );

    if (slowEndpoints.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: `${slowEndpoints.length} endpoints responding slowly (>5s)`,
        action: 'Optimize function performance or check server resources'
      });
    }

    // Redirect recommendations
    const failedRedirects = Object.entries(this.results.redirects).filter(([_, data]) => 
      !data.correct
    );

    if (failedRedirects.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'redirects',
        message: `${failedRedirects.length} redirect rules not working correctly`,
        action: 'Check netlify.toml redirect configuration'
      });
    }

    return recommendations;
  }

  // Run complete security audit
  async runCompleteAudit() {
    console.log(`🔍 Starting security audit for ${DOMAIN}...`);
    console.log('='.repeat(60));

    try {
      // Check SSL
      console.log('📋 Checking SSL certificate...');
      this.results.ssl_status = await this.checkSSL(DOMAIN);

      // Check security headers
      console.log('🛡️ Checking security headers...');
      this.results.security_headers = await this.checkSecurityHeaders(DOMAIN);

      // Check redirects
      console.log('🔄 Checking redirects...');
      this.results.redirects = await this.checkRedirects();

      // Check endpoints
      console.log('⚡ Checking endpoint performance...');
      for (const endpoint of TEST_ENDPOINTS) {
        console.log(`   Testing: ${endpoint}`);
        this.results.endpoints[endpoint] = await this.checkEndpoint(endpoint);
      }

      // Calculate performance metrics
      const responseTimes = Object.values(this.results.endpoints).map(e => e.response_time);
      this.results.performance = {
        average_response_time: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        max_response_time: Math.max(...responseTimes),
        min_response_time: Math.min(...responseTimes),
        success_rate: Object.values(this.results.endpoints).filter(e => e.success).length / TEST_ENDPOINTS.length * 100
      };

      // Generate recommendations
      this.results.recommendations = this.generateRecommendations();

      // Determine overall status
      const sslOk = this.results.ssl_status.valid;
      const headersOk = this.results.security_headers.score >= 80;
      const performanceOk = this.results.performance.success_rate >= 90;

      if (sslOk && headersOk && performanceOk) {
        this.results.overall_status = 'excellent';
      } else if (sslOk && (headersOk || performanceOk)) {
        this.results.overall_status = 'good';
      } else if (sslOk) {
        this.results.overall_status = 'needs_improvement';
      } else {
        this.results.overall_status = 'critical_issues';
      }

    } catch (error) {
      this.results.overall_status = 'audit_failed';
      this.results.error = error.message;
    }

    return this.results;
  }

  // Print detailed report
  printReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DOMAIN SECURITY AUDIT REPORT');
    console.log('='.repeat(60));
    console.log(`🌐 Domain: ${this.results.domain}`);
    console.log(`⏰ Timestamp: ${this.results.timestamp}`);
    console.log(`📈 Overall Status: ${this.results.overall_status.toUpperCase()}`);
    console.log('');

    // SSL Status
    console.log('🔒 SSL CERTIFICATE:');
    if (this.results.ssl_status.valid) {
      console.log(`   ✅ Valid: ${this.results.ssl_status.subject}`);
      console.log(`   📅 Expires: ${this.results.ssl_status.expires} (${this.results.ssl_status.days_until_expiry} days)`);
      console.log(`   🏢 Issuer: ${this.results.ssl_status.issuer}`);
      console.log(`   🔐 Protocol: ${this.results.ssl_status.protocol}`);
    } else {
      console.log(`   ❌ Invalid: ${this.results.ssl_status.error || 'Unknown error'}`);
    }
    console.log('');

    // Security Headers
    console.log('🛡️ SECURITY HEADERS:');
    console.log(`   📊 Score: ${this.results.security_headers.score}/100 (Grade: ${this.results.security_headers.grade})`);
    
    Object.entries(this.results.security_headers.headers || {}).forEach(([header, data]) => {
      const status = data.present ? '✅' : '❌';
      console.log(`   ${status} ${header}: ${data.value || 'Not present'}`);
    });
    console.log('');

    // Redirects
    console.log('🔄 REDIRECT TESTS:');
    Object.entries(this.results.redirects).forEach(([from, data]) => {
      const status = data.correct ? '✅' : '❌';
      console.log(`   ${status} ${from} → ${data.location || 'Failed'}`);
    });
    console.log('');

    // Performance
    console.log('⚡ PERFORMANCE METRICS:');
    console.log(`   📊 Success Rate: ${this.results.performance.success_rate.toFixed(1)}%`);
    console.log(`   ⏱️ Average Response: ${this.results.performance.average_response_time}ms`);
    console.log(`   🚀 Fastest: ${this.results.performance.min_response_time}ms`);
    console.log(`   🐌 Slowest: ${this.results.performance.max_response_time}ms`);
    console.log('');

    // Endpoint Details
    console.log('🔗 ENDPOINT STATUS:');
    Object.entries(this.results.endpoints).forEach(([endpoint, data]) => {
      const status = data.success ? '✅' : '❌';
      console.log(`   ${status} ${endpoint} - ${data.status} (${data.response_time}ms)`);
    });
    console.log('');

    // Recommendations
    if (this.results.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      this.results.recommendations.forEach((rec, index) => {
        const priority = rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${index + 1}. ${priority} [${rec.category.toUpperCase()}] ${rec.message}`);
        console.log(`      Action: ${rec.action}`);
      });
    } else {
      console.log('🎉 NO ISSUES FOUND - Your domain security is excellent!');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Audit completed successfully!');
    console.log('='.repeat(60));
  }
}

// Export for external use
export { DomainSecurityMonitor };

// Auto-run if executed directly
const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isDirectExecution) {
  const monitor = new DomainSecurityMonitor();
  
  monitor.runCompleteAudit().then((results) => {
    monitor.printReport();
    
  // Save results to file
  fs.writeFileSync('domain-security-report.json', JSON.stringify(results, null, 2));
    console.log('\n📄 Detailed report saved to domain-security-report.json');
    
    // Exit with appropriate code
    process.exit(results.overall_status === 'critical_issues' ? 1 : 0);
  }).catch(error => {
    console.error('💥 Audit failed:', error);
    process.exit(1);
  });
}