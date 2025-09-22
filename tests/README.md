# SichrPlace Functions Test Suite

Comprehensive testing suite for all 56 Netlify Functions in the SichrPlace platform.

## 🧪 Test Suite Features

- **Complete Coverage**: Tests all 56 Netlify Functions
- **Simple & Fast**: Lightweight tests focused on basic functionality
- **Multiple Environments**: Support for local, staging, and production testing
- **Detailed Reporting**: JSON output with comprehensive test results
- **Easy Execution**: Batch files and npm scripts for quick testing

## 📋 Test Categories

### Authentication Functions (9 tests)
- `auth-login` - User login functionality
- `auth-register` - User registration
- `auth-me` - Current user information
- `auth-forgot-password` - Password reset request
- `auth-reset-password` - Password reset execution
- `auth-verify` - Email verification
- `auth-verify-reset-token` - Reset token validation
- `auth-resend-verification` - Resend verification email
- `csrf-token` - CSRF token generation

### Core Platform Functions (6 tests)
- `apartments` - Apartment listings
- `add-property` - Property submission
- `search` - Basic search functionality
- `advanced-search` - Advanced search with filters
- `favorites` - User favorites management
- `recently-viewed` - Recently viewed properties

### Communication Functions (5 tests)
- `conversations` - Chat conversations
- `messages` - Message handling
- `chats` - Chat functionality
- `realtime-chat` - Real-time messaging
- `notifications` - User notifications

### Admin Functions (4 tests)
- `admin` - Admin dashboard
- `system-administration` - System admin tools
- `user-management` - User management
- `content-moderation` - Content moderation

### Analytics Functions (5 tests)
- `analytics-stats` - Platform statistics
- `revenue-analytics` - Revenue tracking
- `user-engagement-analytics` - User engagement metrics
- `performance-overview` - Performance monitoring
- `user-activity-tracking` - Activity tracking

### Maps Integration Functions (6 tests)
- `maps-geocode` - Address to coordinates
- `maps-reverse-geocode` - Coordinates to address
- `maps-distance` - Distance calculations
- `maps-nearby-places` - Nearby places search
- `maps-search-by-location` - Location-based search
- `maps-place-types` - Available place types

### GDPR & Privacy Functions (4 tests)
- `gdpr-compliance` - GDPR compliance tools
- `gdpr-tracking` - Data processing tracking
- `consent-management` - User consent management
- `privacy-controls` - Privacy control settings

### Payment Functions (2 tests)
- `paypal-integration` - PayPal integration
- `paypal-payments` - Payment processing

### Utility Functions (12 tests)
- `booking-requests` - Booking management
- `viewing-requests` - Viewing appointments
- `reviews` - Property reviews
- `email-management` - Email system management
- `email-notifications` - Notification emails
- `email-service` - Email service functionality
- `file-upload` - File upload handling
- `third-party-integrations` - External service integrations
- `user-profile` - User profile management
- `cache-management` - Caching system
- `health` - Main health check
- `simple-health` - Simple health check
- `system-health-check` - Comprehensive system health

### Test Functions (3 tests)
- `hello` - Basic function test
- `test` - General test function

## 🚀 Quick Start

### Windows Users
```bash
# Run the interactive test menu
./run-tests.bat

# Or run directly with PowerShell
cd tests
node quick-test.js          # Quick test (6 functions)
node all-functions-test.js  # Full test suite (56 functions)
```

### Command Line
```bash
cd tests

# Install dependencies (optional)
npm install

# Run quick test
npm run test:quick

# Run full test suite
npm test

# Test against local development server
npm run test:local

# Test against production
npm run test:production
```

## 🔧 Configuration

### Environment Variables
- `NETLIFY_URL` - Target URL for testing (default: http://localhost:8888)

### Test Configuration
Edit the CONFIG object in the test files:
```javascript
const CONFIG = {
    BASE_URL: process.env.NETLIFY_URL || 'http://localhost:8888',
    FUNCTIONS_PATH: '/.netlify/functions',
    TIMEOUT: 10000,
    TEST_USER: {
        email: 'test@sichrplace.com',
        password: 'TestPassword123!',
        username: 'testuser'
    }
};
```

## 📊 Test Results

### Console Output
Tests provide real-time feedback with colored output:
- ✅ Green: Test passed
- ❌ Red: Test failed  
- ⚠️ Yellow: Test skipped

### JSON Reports
Detailed test results are saved to timestamped JSON files:
```
test-results-2025-09-22T10-30-45-123Z.json
```

Sample report structure:
```json
{
  "summary": {
    "passed": 45,
    "failed": 3,
    "skipped": 8,
    "total": 56,
    "duration": 12.5,
    "successRate": "93.8%"
  },
  "details": [
    {
      "name": "auth-login",
      "status": "PASS",
      "message": "Status: 200",
      "timestamp": "2025-09-22T10:30:45.123Z"
    }
  ]
}
```

## 🎯 Test Strategy

### What Each Test Validates
1. **HTTP Response**: Function responds to requests
2. **Status Codes**: Appropriate HTTP status codes (200-499 expected)
3. **Error Handling**: Graceful handling of invalid inputs
4. **Authentication**: Token-based authentication where required
5. **Basic Functionality**: Core function operation

### Test Scenarios
- **Valid Requests**: Normal operation testing
- **Invalid Data**: Error handling validation
- **Authentication**: Token validation
- **Edge Cases**: Boundary condition testing

## 🔍 Troubleshooting

### Common Issues

**Connection Refused**
```
Error: connect ECONNREFUSED
```
- Ensure Netlify Dev is running: `netlify dev`
- Check the BASE_URL configuration
- Verify functions are deployed

**Timeout Errors**
```
Error: Request timeout
```
- Increase timeout in CONFIG
- Check function performance
- Verify network connectivity

**401 Unauthorized**
```
Status: 401
```
- Expected for protected endpoints
- Tests will mark as PASS for auth-required functions

**500 Internal Server Error**
```
Status: 500
```
- Function has runtime errors
- Check function logs
- Verify environment variables

### Debug Mode
Enable detailed logging by modifying the test files:
```javascript
const DEBUG = true; // Add this flag for verbose output
```

## 📈 Success Criteria

### Test Suite Goals
- ✅ **Response Rate**: 100% of functions respond (no connection errors)
- ✅ **Error Rate**: <5% unexpected errors (500+ status codes)
- ✅ **Coverage**: All 56 functions tested
- ✅ **Performance**: Average response time <2 seconds

### Expected Results
Most functions should return:
- **200**: Success (for public endpoints)
- **401**: Unauthorized (for protected endpoints) 
- **400**: Bad Request (for invalid data)
- **404**: Not Found (for missing resources)

## 🛠 Extending Tests

### Adding New Function Tests
1. Add test method to `functionTests` object
2. Follow naming convention: `testFunctionName()`
3. Include basic validation logic
4. Handle authentication if required

Example:
```javascript
async testNewFunction() {
    try {
        const response = await makeRequest('GET', '/new-function');
        
        if (response.statusCode >= 200 && response.statusCode < 500) {
            logTest('new-function', 'PASS', `Status: ${response.statusCode}`);
        } else {
            logTest('new-function', 'FAIL', `Status: ${response.statusCode}`);
        }
    } catch (error) {
        logTest('new-function', 'FAIL', `Error: ${error.message}`);
    }
}
```

### Custom Test Scenarios
Modify individual test methods to add:
- Data validation tests
- Performance benchmarks
- Integration tests
- Security validation

## 🎉 Next Steps

After running tests:

1. **Review Results**: Check the JSON report for detailed analysis
2. **Fix Failures**: Address any failed tests
3. **Performance Optimization**: Improve slow-responding functions
4. **Security Audit**: Review authentication and validation
5. **Documentation**: Update API documentation based on test results

## 📝 Notes

- Tests are designed to be **non-destructive**
- No real data is created or modified
- Authentication tests use test credentials
- Functions should handle test requests gracefully
- Results help identify deployment and configuration issues

---

**Happy Testing! 🧪✨**