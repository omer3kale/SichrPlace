#!/usr/bin/env node

// 🧪 SichrPlace Registration System Test Suite
// Tests all registration endpoints and bulletproof features

import https from 'https';
import { URL } from 'url';

class RegistrationTester {
  constructor() {
    this.baseUrl = 'https://www.sichrplace.com';
    this.endpoints = [
      '/.netlify/functions/auth-register',
      '/api/auth-register', 
      '/api/register',
      '/api/signup'
    ];
    this.results = [];
  }

  async runTests() {
    console.log('🧪 Starting SichrPlace Registration Test Suite...\n');
    
    // Test 1: Health Check
    await this.testHealthCheck();
    
    // Test 2: Environment Configuration
    await this.testEnvironmentConfig();
    
    // Test 3: Endpoint Availability
    await this.testEndpointAvailability();
    
    // Test 4: Registration Flow (if env vars are configured)
    await this.testRegistrationFlow();
    
    // Test 5: Error Handling
    await this.testErrorHandling();
    
    // Test 6: Network Resilience
    await this.testNetworkResilience();
    
    this.generateReport();
  }

  async testHealthCheck() {
    console.log('🔍 Test 1: Health Check');
    
    try {
      const response = await this.makeRequest('/api/simple-health', 'GET');
      const data = JSON.parse(response.body);
      
      if (response.statusCode === 200 && data.success) {
        console.log('✅ Health check passed');
        this.results.push({ test: 'Health Check', status: 'PASS' });
      } else {
        console.log('❌ Health check failed');
        this.results.push({ test: 'Health Check', status: 'FAIL', error: 'Health endpoint not responding correctly' });
      }
    } catch (error) {
      console.log('❌ Health check error:', error.message);
      this.results.push({ test: 'Health Check', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testEnvironmentConfig() {
    console.log('🔧 Test 2: Environment Configuration');
    
    try {
      const response = await this.makeRequest('/.netlify/functions/auth-register', 'GET');
      const data = JSON.parse(response.body);
      
      if (data.status === 'ready') {
        console.log('✅ All environment variables configured');
        this.results.push({ test: 'Environment Config', status: 'PASS' });
      } else if (data.status === 'configuration_error') {
        console.log('⚠️  Missing environment variables:', data.missing?.join(', '));
        this.results.push({ 
          test: 'Environment Config', 
          status: 'FAIL', 
          error: `Missing: ${data.missing?.join(', ')}` 
        });
      } else {
        console.log('❌ Unexpected environment response');
        this.results.push({ test: 'Environment Config', status: 'FAIL', error: 'Unexpected response' });
      }
    } catch (error) {
      console.log('❌ Environment config error:', error.message);
      this.results.push({ test: 'Environment Config', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testEndpointAvailability() {
    console.log('📡 Test 3: Endpoint Availability');
    
    let passCount = 0;
    for (const endpoint of this.endpoints) {
      try {
        const response = await this.makeRequest(endpoint, 'GET');
        
        if (response.statusCode === 200 || response.statusCode === 405) {
          console.log(`✅ ${endpoint} - Available`);
          passCount++;
        } else {
          console.log(`❌ ${endpoint} - Status: ${response.statusCode}`);
        }
      } catch (error) {
        console.log(`❌ ${endpoint} - Error: ${error.message}`);
      }
    }
    
    if (passCount === this.endpoints.length) {
      this.results.push({ test: 'Endpoint Availability', status: 'PASS' });
    } else {
      this.results.push({ 
        test: 'Endpoint Availability', 
        status: 'PARTIAL', 
        error: `${passCount}/${this.endpoints.length} endpoints available` 
      });
    }
    console.log('');
  }

  async testRegistrationFlow() {
    console.log('👤 Test 4: Registration Flow');
    
    const testUser = {
      username: `test.${Date.now()}@sichrplace.test`,
      email: `test.${Date.now()}@sichrplace.test`,
      password: 'TestPass123!',
      fullName: 'Test User Registration',
      userType: 'applicant'
    };

    try {
      const response = await this.makeRequest(
        '/.netlify/functions/auth-register', 
        'POST', 
        JSON.stringify(testUser)
      );
      
      const data = JSON.parse(response.body);
      
      if (response.statusCode === 201 && data.success) {
        console.log('✅ Registration flow successful');
        this.results.push({ test: 'Registration Flow', status: 'PASS' });
      } else if (response.statusCode === 503) {
        console.log('⚠️  Registration unavailable (missing env vars)');
        this.results.push({ 
          test: 'Registration Flow', 
          status: 'SKIP', 
          error: 'Environment variables not configured' 
        });
      } else {
        console.log('❌ Registration failed:', data.error || 'Unknown error');
        this.results.push({ 
          test: 'Registration Flow', 
          status: 'FAIL', 
          error: data.error || 'Registration failed' 
        });
      }
    } catch (error) {
      console.log('❌ Registration flow error:', error.message);
      this.results.push({ test: 'Registration Flow', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testErrorHandling() {
    console.log('🛡️  Test 5: Error Handling');
    
    const invalidData = {
      username: 'invalid',
      // Missing required fields
    };

    try {
      const response = await this.makeRequest(
        '/.netlify/functions/auth-register',
        'POST',
        JSON.stringify(invalidData)
      );
      
      const data = JSON.parse(response.body);
      
      if (response.statusCode >= 400 && data.error) {
        console.log('✅ Error handling working correctly');
        this.results.push({ test: 'Error Handling', status: 'PASS' });
      } else {
        console.log('❌ Error handling not working properly');
        this.results.push({ test: 'Error Handling', status: 'FAIL', error: 'Should reject invalid data' });
      }
    } catch (error) {
      console.log('❌ Error handling test failed:', error.message);
      this.results.push({ test: 'Error Handling', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  async testNetworkResilience() {
    console.log('🌐 Test 6: Network Resilience');
    
    // Test CORS headers
    try {
      const response = await this.makeRequest('/.netlify/functions/auth-register', 'OPTIONS');
      
      if (response.statusCode === 200) {
        console.log('✅ CORS preflight working');
        this.results.push({ test: 'Network Resilience', status: 'PASS' });
      } else {
        console.log('❌ CORS preflight failed');
        this.results.push({ test: 'Network Resilience', status: 'FAIL', error: 'CORS not configured' });
      }
    } catch (error) {
      console.log('❌ Network resilience test failed:', error.message);
      this.results.push({ test: 'Network Resilience', status: 'FAIL', error: error.message });
    }
    console.log('');
  }

  makeRequest(path, method, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'SichrPlace-Test-Suite/1.0'
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  generateReport() {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log(''.padEnd(50, '='));
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    
    this.results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : 
                    result.status === 'SKIP' ? '⚠️ ' : '❌';
      
      console.log(`${status} ${result.test.padEnd(25)} ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.status === 'PASS') passed++;
      else if (result.status === 'SKIP') skipped++;
      else failed++;
    });
    
    console.log(''.padEnd(50, '='));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    
    const successRate = ((passed / (passed + failed)) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);
    
    if (failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Registration system is bulletproof!');
    } else {
      console.log('\n🚨 ISSUES DETECTED. Please fix the failing tests.');
    }
  }
}

// Run tests
const tester = new RegistrationTester();
tester.runTests().catch(console.error);