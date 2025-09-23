/**
 * Comprehensive API Endpoint Testing Script for RExeli V1
 * Tests all API endpoints with proper error handling and validation
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

// Test configurations
const TEST_CONFIG = {
  maxFileSize: 25 * 1024 * 1024, // 25MB
  allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  supportedDocumentTypes: ['rent_roll', 'offering_memo', 'lease_agreement', 'comparable_sales', 'financial_statement']
};

// Create test image data (1x1 PNG)
const createTestImage = () => {
  // Minimal 1x1 PNG data
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x5C, 0xC2, 0x88, 0x05, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  return new Blob([pngData], { type: 'image/png' });
};

// Test results storage
const testResults = {
  upload: [],
  classify: [],
  extract: [],
  export: [],
  errors: [],
  summary: {}
};

// Utility function to log test results
function logTest(category, testName, status, details = {}) {
  const result = {
    testName,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };

  testResults[category].push(result);
  console.log(`[${category.toUpperCase()}] ${testName}: ${status}`);
  if (details.error) {
    console.error(`  Error: ${details.error}`);
  }
  if (details.response) {
    console.log(`  Response: ${JSON.stringify(details.response, null, 2)}`);
  }
}

// Test 1: Upload API Endpoint
async function testUploadAPI() {
  console.log('\n=== Testing Upload API (/api/upload) ===');

  try {
    // Test 1.1: Valid PNG file upload
    const testImage = createTestImage();
    const formData = new FormData();
    formData.append('file', testImage, 'test-image.png');

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.success) {
      logTest('upload', 'Valid PNG Upload', 'PASS', {
        response: result,
        fileSize: testImage.size
      });
      return result.data; // Return upload result for further testing
    } else {
      logTest('upload', 'Valid PNG Upload', 'FAIL', {
        error: result.error || 'Upload failed',
        status: response.status
      });
    }
  } catch (error) {
    logTest('upload', 'Valid PNG Upload', 'ERROR', { error: error.message });
  }

  try {
    // Test 1.2: No file provided
    const formData = new FormData();
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('upload', 'No File Validation', 'PASS', { response: result });
    } else {
      logTest('upload', 'No File Validation', 'FAIL', {
        error: 'Should reject requests without files',
        response: result
      });
    }
  } catch (error) {
    logTest('upload', 'No File Validation', 'ERROR', { error: error.message });
  }

  try {
    // Test 1.3: Invalid file type
    const textBlob = new Blob(['test content'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', textBlob, 'test.txt');

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('upload', 'Invalid File Type Validation', 'PASS', { response: result });
    } else {
      logTest('upload', 'Invalid File Type Validation', 'FAIL', {
        error: 'Should reject invalid file types',
        response: result
      });
    }
  } catch (error) {
    logTest('upload', 'Invalid File Type Validation', 'ERROR', { error: error.message });
  }

  return null;
}

// Test 2: Classification API Endpoint
async function testClassifyAPI() {
  console.log('\n=== Testing Classification API (/api/classify) ===');

  try {
    // Test 2.1: Valid image classification
    const testImage = createTestImage();
    const formData = new FormData();
    formData.append('file', testImage, 'test-document.png');

    const response = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.success) {
      logTest('classify', 'Valid Image Classification', 'PASS', {
        response: result,
        classification: result.data?.classification
      });
      return result.data?.classification;
    } else {
      logTest('classify', 'Valid Image Classification', 'FAIL', {
        error: result.error || 'Classification failed',
        status: response.status
      });
    }
  } catch (error) {
    logTest('classify', 'Valid Image Classification', 'ERROR', { error: error.message });
  }

  try {
    // Test 2.2: No file provided
    const formData = new FormData();
    const response = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('classify', 'No File Validation', 'PASS', { response: result });
    } else {
      logTest('classify', 'No File Validation', 'FAIL', {
        error: 'Should reject requests without files',
        response: result
      });
    }
  } catch (error) {
    logTest('classify', 'No File Validation', 'ERROR', { error: error.message });
  }

  return null;
}

// Test 3: Extraction API Endpoint
async function testExtractionAPI() {
  console.log('\n=== Testing Extraction API (/api/extract) ===');

  try {
    // Test 3.1: Valid extraction with document type
    const testImage = createTestImage();
    const formData = new FormData();
    formData.append('file', testImage, 'test-document.png');
    formData.append('documentType', 'rent_roll');

    const response = await fetch(`${BASE_URL}/api/extract`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.ok && result.success) {
      logTest('extract', 'Valid Extraction', 'PASS', {
        response: result,
        extractedData: result.data?.extractedData
      });
      return result.data?.extractedData;
    } else {
      logTest('extract', 'Valid Extraction', 'FAIL', {
        error: result.error || 'Extraction failed',
        status: response.status
      });
    }
  } catch (error) {
    logTest('extract', 'Valid Extraction', 'ERROR', { error: error.message });
  }

  try {
    // Test 3.2: Missing document type
    const testImage = createTestImage();
    const formData = new FormData();
    formData.append('file', testImage, 'test-document.png');

    const response = await fetch(`${BASE_URL}/api/extract`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('extract', 'Missing Document Type Validation', 'PASS', { response: result });
    } else {
      logTest('extract', 'Missing Document Type Validation', 'FAIL', {
        error: 'Should reject requests without document type',
        response: result
      });
    }
  } catch (error) {
    logTest('extract', 'Missing Document Type Validation', 'ERROR', { error: error.message });
  }

  try {
    // Test 3.3: Invalid document type
    const testImage = createTestImage();
    const formData = new FormData();
    formData.append('file', testImage, 'test-document.png');
    formData.append('documentType', 'invalid_type');

    const response = await fetch(`${BASE_URL}/api/extract`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('extract', 'Invalid Document Type Validation', 'PASS', { response: result });
    } else {
      logTest('extract', 'Invalid Document Type Validation', 'FAIL', {
        error: 'Should reject invalid document types',
        response: result
      });
    }
  } catch (error) {
    logTest('extract', 'Invalid Document Type Validation', 'ERROR', { error: error.message });
  }

  return null;
}

// Test 4: Export API Endpoint
async function testExportAPI() {
  console.log('\n=== Testing Export API (/api/export) ===');

  try {
    // Test 4.1: Valid export with mock data
    const mockExtractedData = {
      documentType: 'rent_roll',
      metadata: {
        propertyName: 'Test Property',
        propertyAddress: '123 Test St',
        totalSquareFeet: 10000,
        totalUnits: 10,
        extractedDate: new Date().toISOString()
      },
      data: {
        properties: [
          {
            unitNumber: '101',
            tenant: 'Test Tenant',
            squareFeet: 1000,
            monthlyRent: 2000,
            leaseStart: '2024-01-01',
            leaseEnd: '2024-12-31',
            occupancyStatus: 'occupied'
          }
        ],
        summary: {
          totalRent: 2000,
          occupancyRate: 1.0,
          totalSquareFeet: 1000,
          averageRentPsf: 2.0
        }
      }
    };

    const response = await fetch(`${BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extractedData: mockExtractedData,
        options: {
          includeRawData: true,
          includeCharts: false,
          formatForPrint: true
        }
      })
    });

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('spreadsheetml')) {
        logTest('export', 'Valid Export', 'PASS', {
          contentType,
          contentLength: response.headers.get('content-length')
        });
        return true;
      } else {
        logTest('export', 'Valid Export', 'FAIL', {
          error: 'Invalid content type returned',
          contentType
        });
      }
    } else {
      const result = await response.json();
      logTest('export', 'Valid Export', 'FAIL', {
        error: result.error || 'Export failed',
        status: response.status
      });
    }
  } catch (error) {
    logTest('export', 'Valid Export', 'ERROR', { error: error.message });
  }

  try {
    // Test 4.2: Missing extracted data
    const response = await fetch(`${BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        options: {
          includeRawData: true
        }
      })
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('export', 'Missing Data Validation', 'PASS', { response: result });
    } else {
      logTest('export', 'Missing Data Validation', 'FAIL', {
        error: 'Should reject requests without extracted data',
        response: result
      });
    }
  } catch (error) {
    logTest('export', 'Missing Data Validation', 'ERROR', { error: error.message });
  }

  try {
    // Test 4.3: Invalid JSON
    const response = await fetch(`${BASE_URL}/api/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });

    const result = await response.json();

    if (response.status === 400 && !result.success) {
      logTest('export', 'Invalid JSON Validation', 'PASS', { response: result });
    } else {
      logTest('export', 'Invalid JSON Validation', 'FAIL', {
        error: 'Should reject invalid JSON',
        response: result
      });
    }
  } catch (error) {
    logTest('export', 'Invalid JSON Validation', 'ERROR', { error: error.message });
  }

  return false;
}

// Test 5: Environment Configuration
async function testEnvironmentConfig() {
  console.log('\n=== Testing Environment Configuration ===');

  // Check if server responds to basic requests
  try {
    const response = await fetch(`${BASE_URL}/`);
    if (response.ok) {
      logTest('upload', 'Server Accessibility', 'PASS', { status: response.status });
    } else {
      logTest('upload', 'Server Accessibility', 'FAIL', { status: response.status });
    }
  } catch (error) {
    logTest('upload', 'Server Accessibility', 'ERROR', { error: error.message });
  }
}

// Generate Test Summary
function generateSummary() {
  console.log('\n=== TEST SUMMARY ===');

  const categories = ['upload', 'classify', 'extract', 'export'];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let errorTests = 0;

  categories.forEach(category => {
    const tests = testResults[category];
    const categoryPassed = tests.filter(t => t.status === 'PASS').length;
    const categoryFailed = tests.filter(t => t.status === 'FAIL').length;
    const categoryErrors = tests.filter(t => t.status === 'ERROR').length;

    console.log(`\n${category.toUpperCase()} API:`);
    console.log(`  Passed: ${categoryPassed}`);
    console.log(`  Failed: ${categoryFailed}`);
    console.log(`  Errors: ${categoryErrors}`);
    console.log(`  Total: ${tests.length}`);

    totalTests += tests.length;
    passedTests += categoryPassed;
    failedTests += categoryFailed;
    errorTests += categoryErrors;
  });

  console.log('\nOVERALL RESULTS:');
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`  Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`  Errors: ${errorTests} (${((errorTests/totalTests)*100).toFixed(1)}%)`);

  testResults.summary = {
    totalTests,
    passedTests,
    failedTests,
    errorTests,
    successRate: ((passedTests/totalTests)*100).toFixed(1)
  };

  return testResults;
}

// Main test execution
async function runAllTests() {
  console.log('Starting RExeli V1 API Endpoint Tests...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    await testEnvironmentConfig();
    await testUploadAPI();
    await testClassifyAPI();
    await testExtractionAPI();
    await testExportAPI();

    const results = generateSummary();

    // Save results to file
    fs.writeFileSync(
      path.join(__dirname, 'api-test-results.json'),
      JSON.stringify(results, null, 2)
    );

    console.log('\nTest results saved to: api-test-results.json');

    return results;
  } catch (error) {
    console.error('Test execution failed:', error);
    return null;
  }
}

// Export for use in Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, testResults };
} else {
  // Run if executed directly
  runAllTests();
}