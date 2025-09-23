/**
 * Comprehensive RExeli Tool Test with Real PDF Document
 * Testing complete workflow: Upload → Classification → Extraction → Export
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3001';
const PDF_PATH = 'c:\\Users\\cruiz\\Downloads\\DFW MH Class A Sales Comps  2025 .pdf';

// Test results tracking
const testResults = {
  upload: { success: false, error: null, data: null },
  classify: { success: false, error: null, data: null },
  extract: { success: false, error: null, data: null },
  export: { success: false, error: null, data: null }
};

console.log('🏠 RExeli Document Processing Tool - Comprehensive Test');
console.log('='.repeat(60));
console.log(`Testing with: ${PDF_PATH}`);
console.log(`Server: ${BASE_URL}`);
console.log('='.repeat(60));

async function testStep(stepName, testFunction) {
  console.log(`\n📋 ${stepName}...`);
  console.log('-'.repeat(40));

  try {
    const result = await testFunction();
    console.log(`✅ ${stepName} - SUCCESS`);
    return result;
  } catch (error) {
    console.error(`❌ ${stepName} - FAILED`);
    console.error(`   Error: ${error.message}`);
    throw error;
  }
}

async function checkFileExists() {
  return testStep('Checking PDF file exists', async () => {
    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`PDF file not found: ${PDF_PATH}`);
    }

    const stats = fs.statSync(PDF_PATH);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`   📄 File: ${path.basename(PDF_PATH)}`);
    console.log(`   📊 Size: ${fileSizeMB} MB (${stats.size} bytes)`);

    if (stats.size > 25 * 1024 * 1024) {
      throw new Error(`File too large: ${fileSizeMB}MB exceeds 25MB limit`);
    }

    return { path: PDF_PATH, size: stats.size, sizeMB: fileSizeMB };
  });
}

async function testServerConnection() {
  return testStep('Testing server connection', async () => {
    const response = await fetch(`${BASE_URL}/tool`);

    if (!response.ok) {
      throw new Error(`Server not responding: ${response.status} ${response.statusText}`);
    }

    console.log(`   🌐 Server Status: ${response.status} ${response.statusText}`);
    console.log(`   📡 Response Time: ${response.headers.get('x-response-time') || 'N/A'}`);

    return { status: response.status, statusText: response.statusText };
  });
}

async function testUploadAPI(fileInfo) {
  return testStep('Testing Upload API (/api/upload)', async () => {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(fileInfo.path);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const file = new File([blob], path.basename(fileInfo.path), { type: 'application/pdf' });

    formData.append('file', file);

    console.log(`   📤 Uploading: ${file.name} (${file.type})`);

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const responseText = await response.text();
    console.log(`   📨 Response Status: ${response.status}`);

    if (!response.ok) {
      console.error(`   ❌ Response Body: ${responseText}`);
      throw new Error(`Upload failed: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log(`   ✅ Upload Result:`, {
      fileId: result.data?.fileId,
      url: result.data?.url ? 'Generated' : 'Missing',
      message: result.message
    });

    testResults.upload = { success: true, error: null, data: result.data };
    return result.data;
  });
}

async function testClassifyAPI(fileInfo) {
  return testStep('Testing Classification API (/api/classify)', async () => {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(fileInfo.path);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const file = new File([blob], path.basename(fileInfo.path), { type: 'application/pdf' });

    formData.append('file', file);

    console.log(`   🤖 Classifying document with OpenAI...`);
    console.log(`   📄 Document: ${file.name} (${file.type})`);

    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      body: formData
    });
    const processingTime = Date.now() - startTime;

    const responseText = await response.text();
    console.log(`   ⏱️  Processing Time: ${processingTime}ms`);
    console.log(`   📨 Response Status: ${response.status}`);

    if (!response.ok) {
      console.error(`   ❌ Response Body: ${responseText}`);
      throw new Error(`Classification failed: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log(`   ✅ Classification Result:`, {
      type: result.data?.classification?.type,
      confidence: result.data?.classification?.confidence,
      reasoning: result.data?.classification?.reasoning?.substring(0, 100) + '...'
    });

    testResults.classify = { success: true, error: null, data: result.data };
    return result.data;
  });
}

async function testExtractionAPI(fileInfo, classification) {
  return testStep('Testing Data Extraction API (/api/extract)', async () => {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(fileInfo.path);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    const file = new File([blob], path.basename(fileInfo.path), { type: 'application/pdf' });

    formData.append('file', file);
    formData.append('documentType', classification.classification.type);

    console.log(`   🔍 Extracting data for type: ${classification.classification.type}`);

    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/extract`, {
      method: 'POST',
      body: formData
    });
    const processingTime = Date.now() - startTime;

    const responseText = await response.text();
    console.log(`   ⏱️  Processing Time: ${processingTime}ms`);
    console.log(`   📨 Response Status: ${response.status}`);

    if (!response.ok) {
      console.error(`   ❌ Response Body: ${responseText}`);
      throw new Error(`Extraction failed: ${response.status} ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log(`   ✅ Extraction Result:`, {
      documentType: result.data?.extractedData?.documentType,
      hasMetadata: !!result.data?.extractedData?.metadata,
      hasData: !!result.data?.extractedData?.data,
      processingTime: result.data?.processingTime + 'ms'
    });

    testResults.extract = { success: true, error: null, data: result.data };
    return result.data;
  });
}

async function testExportAPI(extractedData) {
  return testStep('Testing Excel Export API (/api/export)', async () => {
    const requestBody = {
      extractedData: extractedData.extractedData,
      options: { includeCharts: true, formatNumbers: true }
    };

    console.log(`   📊 Generating Excel for: ${extractedData.extractedData.documentType}`);

    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    const processingTime = Date.now() - startTime;

    console.log(`   ⏱️  Processing Time: ${processingTime}ms`);
    console.log(`   📨 Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Response Body: ${errorText}`);
      throw new Error(`Export failed: ${response.status} ${errorText}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1];

    console.log(`   ✅ Excel Export Result:`, {
      contentType: contentType,
      fileSize: contentLength ? `${Math.round(contentLength / 1024)}KB` : 'Unknown',
      filename: filename || 'Unknown',
      success: true
    });

    // Save the Excel file for verification
    const buffer = await response.arrayBuffer();
    const outputPath = path.join(__dirname, `test-output-${Date.now()}.xlsx`);
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`   💾 Excel saved to: ${outputPath}`);

    testResults.export = { success: true, error: null, data: { filename, size: buffer.byteLength } };
    return { filename, size: buffer.byteLength, path: outputPath };
  });
}

async function printFinalResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(60));

  const steps = [
    { name: 'Upload API', result: testResults.upload },
    { name: 'Classification API', result: testResults.classify },
    { name: 'Data Extraction API', result: testResults.extract },
    { name: 'Excel Export API', result: testResults.export }
  ];

  let totalSuccess = 0;

  steps.forEach(step => {
    const status = step.result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${step.name}`);
    if (step.result.success) totalSuccess++;
    if (step.result.error) {
      console.log(`     Error: ${step.result.error}`);
    }
  });

  console.log('-'.repeat(60));
  console.log(`🎯 Overall Success Rate: ${totalSuccess}/${steps.length} (${Math.round(totalSuccess/steps.length*100)}%)`);

  if (totalSuccess === steps.length) {
    console.log('🎉 ALL TESTS PASSED! RExeli tool is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above for details.');
  }

  console.log('='.repeat(60));
}

// Main test execution
async function runCompleteTest() {
  try {
    console.log('🚀 Starting comprehensive RExeli test...\n');

    // Pre-flight checks
    const fileInfo = await checkFileExists();
    await testServerConnection();

    // Main workflow tests
    const uploadResult = await testUploadAPI(fileInfo);
    const classificationResult = await testClassifyAPI(fileInfo);
    const extractionResult = await testExtractionAPI(fileInfo, classificationResult);
    const exportResult = await testExportAPI(extractionResult);

    await printFinalResults();

  } catch (error) {
    console.error(`\n💥 TEST SUITE FAILED: ${error.message}`);
    await printFinalResults();
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled Promise Rejection:', error);
  process.exit(1);
});

// Run the test
runCompleteTest();