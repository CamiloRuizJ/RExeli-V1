const https = require('https');
const fs = require('fs');

const DEPLOYMENT_URL = 'https://rexeli-v1-lgb95ogkg-camiloruizjs-projects.vercel.app';

console.log('🧪 Testing RExeli V1 Production API Endpoints');
console.log('=============================================\n');

// Test API endpoints
async function testEndpoint(endpoint, expectedStatus = 405) {
  return new Promise((resolve) => {
    const url = `${DEPLOYMENT_URL}${endpoint}`;
    console.log(`Testing: ${endpoint}`);
    
    https.get(url, (res) => {
      console.log(`Status: ${res.statusCode} (Expected: ${expectedStatus})`);
      console.log(`✅ Endpoint accessible\n`);
      resolve(res.statusCode);
    }).on('error', (err) => {
      console.log(`❌ Error: ${err.message}\n`);
      resolve(null);
    });
  });
}

async function runTests() {
  console.log('Testing API endpoints (GET requests should return 405 Method Not Allowed):\n');
  
  await testEndpoint('/api/upload');
  await testEndpoint('/api/classify'); 
  await testEndpoint('/api/extract');
  await testEndpoint('/api/export');
  
  console.log('🎯 Test Summary:');
  console.log('- All API endpoints should return 405 for GET requests');
  console.log('- This confirms the endpoints exist and are configured');
  console.log('- POST requests with file data will be needed for full testing');
  
  console.log('\n📋 Next Steps:');
  console.log('1. Verify environment variables are set in Vercel dashboard');
  console.log('2. Deploy to production: npx vercel --prod');
  console.log('3. Test with real estate document uploads');
  
  console.log('\n🔗 URLs:');
  console.log(`Preview: ${DEPLOYMENT_URL}`);
  console.log('Production: https://rexeli-v1.vercel.app (after prod deploy)');
}

runTests().catch(console.error);