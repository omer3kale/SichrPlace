// =====================================================
// TENANT SCREENING API ENDPOINTS TEST
// =====================================================
// Test all 4 tenant screening Netlify functions
// Run: node test-tenant-screening-apis.js

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8888/.netlify/functions';
const TEST_USER_ID = '12345678-1234-5678-9123-123456789012'; // Test UUID
const TEST_APARTMENT_ID = '87654321-4321-8765-4321-210987654321'; // Test UUID

// ANSI Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bright: '\x1b[1m'
};

console.log(`${colors.bright}${colors.cyan}🚀 SICHRPLACE TENANT SCREENING API TESTS${colors.reset}`);
console.log('=' * 60);

// Test data for each API endpoint
const testData = {
    schufaCheck: {
        user_id: TEST_USER_ID,
        apartment_id: TEST_APARTMENT_ID,
        first_name: 'Max',
        last_name: 'Mustermann',
        date_of_birth: '1990-05-15',
        address: 'Musterstraße 123',
        postal_code: '10115',
        city: 'Berlin'
    },
    employmentVerification: {
        user_id: TEST_USER_ID,
        apartment_id: TEST_APARTMENT_ID,
        employer_name: 'Tech Solutions GmbH',
        position_title: 'Software Developer',
        employment_type: 'permanent',
        employment_start_date: '2020-01-15',
        gross_monthly_salary: 4500.00,
        net_monthly_salary: 3200.00,
        monthly_rent: 1200.00
    },
    landlordReferences: {
        user_id: TEST_USER_ID,
        apartment_id: TEST_APARTMENT_ID,
        references: [
            {
                landlord_name: 'Klaus Müller',
                landlord_email: 'klaus.mueller@example.com',
                landlord_phone: '+49 30 12345678',
                property_address: 'Alte Wohnung Str. 45, 10117 Berlin',
                tenancy_start_date: '2018-03-01',
                tenancy_end_date: '2023-02-28',
                monthly_rent: 1000.00
            }
        ]
    },
    financialQualification: {
        user_id: TEST_USER_ID,
        apartment_id: TEST_APARTMENT_ID,
        monthly_rent: 1200.00,
        total_gross_income: 4500.00,
        estimated_net_income: 3200.00,
        income_breakdown: {
            primary: 4500.00,
            secondary: 0,
            bonus: 500.00,
            freelance: 0,
            benefits: 0,
            partner: 0
        },
        existing_debts: 250.00,
        monthly_expenses: 800.00,
        income_type: 'permanent_employment'
    }
};

// Test function for each API endpoint
async function testAPI(endpoint, data, description) {
    console.log(`\n${colors.bright}${colors.blue}🧪 Testing: ${description}${colors.reset}`);
    console.log(`${colors.yellow}Endpoint: ${endpoint}${colors.reset}`);
    
    try {
        const response = await fetch(`${BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const responseText = await response.text();
        let result;
        
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            result = { raw_response: responseText };
        }
        
        if (response.ok) {
            console.log(`${colors.green}✅ SUCCESS (${response.status})${colors.reset}`);
            console.log(`${colors.cyan}Response:${colors.reset}`, JSON.stringify(result, null, 2));
        } else {
            console.log(`${colors.red}❌ FAILED (${response.status})${colors.reset}`);
            console.log(`${colors.red}Error:${colors.reset}`, JSON.stringify(result, null, 2));
        }
        
        return { success: response.ok, status: response.status, data: result };
        
    } catch (error) {
        console.log(`${colors.red}❌ NETWORK ERROR${colors.reset}`);
        console.log(`${colors.red}Error:${colors.reset}`, error.message);
        return { success: false, error: error.message };
    }
}

// Main test execution
async function runAllTests() {
    console.log(`${colors.bright}Starting tenant screening API tests...${colors.reset}\n`);
    
    const tests = [
        {
            endpoint: 'tenant-screening-schufa',
            data: testData.schufaCheck,
            description: 'SCHUFA Credit Check API'
        },
        {
            endpoint: 'tenant-screening-employment',
            data: testData.employmentVerification,
            description: 'Employment Verification API'
        },
        {
            endpoint: 'tenant-screening-references',
            data: testData.landlordReferences,
            description: 'Landlord References API'
        },
        {
            endpoint: 'tenant-screening-financial',
            data: testData.financialQualification,
            description: 'Financial Qualification API'
        }
    ];
    
    const results = [];
    
    for (const test of tests) {
        const result = await testAPI(test.endpoint, test.data, test.description);
        results.push({
            endpoint: test.endpoint,
            description: test.description,
            ...result
        });
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log(`\n${colors.bright}${colors.magenta}📊 TEST SUMMARY${colors.reset}`);
    console.log('=' * 60);
    
    let passed = 0;
    let failed = 0;
    
    results.forEach(result => {
        const status = result.success ? 
            `${colors.green}✅ PASSED${colors.reset}` : 
            `${colors.red}❌ FAILED${colors.reset}`;
        
        console.log(`${result.description}: ${status}`);
        
        if (result.success) passed++;
        else failed++;
    });
    
    console.log(`\n${colors.bright}Results: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    
    if (failed === 0) {
        console.log(`\n${colors.bright}${colors.green}🎉 ALL TENANT SCREENING APIs WORKING! Ready for production.${colors.reset}`);
    } else {
        console.log(`\n${colors.bright}${colors.yellow}⚠️  Some APIs need attention before production deployment.${colors.reset}`);
    }
    
    return results;
}

// Health check first
async function healthCheck() {
    console.log(`${colors.bright}🏥 Health Check: Netlify Dev Server${colors.reset}`);
    
    try {
        const response = await fetch(`${BASE_URL}/hello`);
        if (response.ok) {
            console.log(`${colors.green}✅ Netlify dev server is running${colors.reset}`);
            return true;
        } else {
            console.log(`${colors.red}❌ Netlify dev server issue (${response.status})${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ Cannot connect to Netlify dev server${colors.reset}`);
        console.log(`${colors.yellow}💡 Make sure to run: netlify dev --port 8888${colors.reset}`);
        return false;
    }
}

// Run tests
async function main() {
    const isHealthy = await healthCheck();
    
    if (!isHealthy) {
        console.log(`\n${colors.red}Please start Netlify dev server first:${colors.reset}`);
        console.log(`${colors.cyan}cd "C:\\Users\\ÖmerÜckale\\OneDrive - NEA X GmbH\\Desktop\\vs code files\\devsichrplace\\sichrplace"${colors.reset}`);
        console.log(`${colors.cyan}netlify dev --port 8888${colors.reset}`);
        process.exit(1);
    }
    
    await runAllTests();
}

main().catch(console.error);