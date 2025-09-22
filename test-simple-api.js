// Simple test for tenant screening APIs
console.log('🧪 Testing Tenant Screening APIs...\n');

async function testAPI(endpoint, description) {
    try {
        const response = await fetch(`http://localhost:8888/.netlify/functions/${endpoint}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        const status = response.ok ? '✅ WORKING' : '❌ ERROR';
        console.log(`${description}: ${status} (${response.status})`);
        
    } catch (error) {
        console.log(`${description}: ❌ NETWORK ERROR - ${error.message}`);
    }
}

async function main() {
    // Test basic function first
    await testAPI('hello', 'Basic Function Test');
    
    // Test tenant screening functions
    await testAPI('tenant-screening-schufa', 'SCHUFA Credit Check');
    await testAPI('tenant-screening-employment', 'Employment Verification');
    await testAPI('tenant-screening-references', 'Landlord References');
    await testAPI('tenant-screening-financial', 'Financial Qualification');
    
    console.log('\n🏁 Test complete!');
}

main().catch(console.error);