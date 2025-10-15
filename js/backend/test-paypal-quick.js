#!/usr/bin/env node
/**
 * Quick PayPal Integration Test
 * Tests the PayPal routes to verify credentials and integration
 */

require('dotenv').config();
const express = require('express');
const paypalRoutes = require('./routes/paypal');

const app = express();
app.use(express.json());
app.use('/api/paypal', paypalRoutes);

const PORT = 3001;

const server = app.listen(PORT, async () => {
  console.log(`\n🧪 PayPal Integration Test Server running on http://localhost:${PORT}\n`);
  
  try {
    // Test 1: Check PayPal Config
    console.log('📋 Test 1: Checking PayPal Configuration...');
    const configResponse = await fetch(`http://localhost:${PORT}/api/paypal/config`);
    const configData = await configResponse.json();
    
    if (configResponse.ok) {
      console.log('✅ PayPal Config Retrieved:');
      console.log('   - Client ID:', configData.clientId?.substring(0, 20) + '...');
      console.log('   - Environment:', configData.environment);
      console.log('   - Currency:', configData.currency);
    } else {
      console.error('❌ PayPal Config Failed:', configData);
      process.exit(1);
    }
    
    // Test 2: Create PayPal Order
    console.log('\n📋 Test 2: Creating PayPal Order...');
    const createResponse = await fetch(`http://localhost:${PORT}/api/paypal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 25.00,
        currency: 'EUR',
        description: 'Test Viewing Request',
        apartmentId: 'TEST-123',
        viewingRequestId: 'VR-TEST-' + Date.now()
      })
    });
    
    const createData = await createResponse.json();
    
    if (createResponse.ok && createData.success) {
      console.log('✅ PayPal Order Created:');
      console.log('   - Order ID:', createData.orderId);
      console.log('   - Approval URL:', createData.approvalUrl?.substring(0, 60) + '...');
      console.log('\n📝 Note: To complete the test, you would need to:');
      console.log('   1. Open the approval URL in a browser');
      console.log('   2. Log in to PayPal sandbox and approve');
      console.log('   3. Capture the order with /api/paypal/execute');
    } else {
      console.error('❌ PayPal Order Creation Failed:', createData);
      process.exit(1);
    }
    
    console.log('\n✅ PayPal Integration Tests PASSED!');
    console.log('🎉 PayPal checkout is properly configured and working!\n');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    server.close();
    process.exit(0);
  }
});
