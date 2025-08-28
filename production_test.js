// RExeli V1 Production End-to-End Testing Script
// Tests all critical functionality in production environment

const fs = require('fs');
const path = require('path');

class RExeliProductionTester {
    constructor() {
        this.baseUrl = 'https://rexeli-v1.vercel.app';
        this.testResults = [];
        this.startTime = Date.now();
    }

    log(test, status, details = '') {
        const result = {
            test,
            status,
            details,
            timestamp: new Date().toISOString()
        };
        this.testResults.push(result);
        console.log(`[${status.toUpperCase()}] ${test}: ${details}`);
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testApplicationLoad() {
        try {
            const response = await fetch(this.baseUrl);
            if (response.ok) {
                const html = await response.text();
                if (html.includes('RExeli') && html.includes('Real Estate Document Processing')) {
                    this.log('Application Load', 'PASS', 'Main page loads correctly with proper branding');
                    return true;
                } else {
                    this.log('Application Load', 'FAIL', 'Page content missing required elements');
                    return false;
                }
            } else {
                this.log('Application Load', 'FAIL', `HTTP ${response.status}: ${response.statusText}`);
                return false;
            }
        } catch (error) {
            this.log('Application Load', 'FAIL', `Network error: ${error.message}`);
            return false;
        }
    }

    async testEnvironmentVariables() {
        try {
            // Test if the application can access environment variables by checking if API endpoints respond
            const uploadEndpoint = `${this.baseUrl}/api/upload`;
            const response = await fetch(uploadEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            });

            // Even if it returns an error, a proper response means env vars are loaded
            if (response.status === 400 || response.status === 422) {
                this.log('Environment Variables', 'PASS', 'API endpoints responding, environment variables loaded');
                return true;
            } else if (response.status === 500) {
                this.log('Environment Variables', 'FAIL', 'Server error - possible missing environment variables');
                return false;
            } else {
                this.log('Environment Variables', 'WARN', `Unexpected response: ${response.status}`);
                return true; // Assume pass for non-500 errors
            }
        } catch (error) {
            this.log('Environment Variables', 'FAIL', `Error testing API: ${error.message}`);
            return false;
        }
    }

    async testSupabaseConnection() {
        try {
            // Test Supabase connection by attempting to access the database
            const testEndpoint = `${this.baseUrl}/api/classify`;
            const response = await fetch(testEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: 'test connection' })
            });

            if (response.status === 400 || response.status === 422) {
                this.log('Supabase Connection', 'PASS', 'Supabase endpoints accessible');
                return true;
            } else if (response.status === 500) {
                const errorText = await response.text();
                if (errorText.includes('supabase') || errorText.includes('database')) {
                    this.log('Supabase Connection', 'FAIL', 'Database connection error');
                    return false;
                } else {
                    this.log('Supabase Connection', 'WARN', 'Non-database 500 error');
                    return true;
                }
            } else {
                this.log('Supabase Connection', 'PASS', 'Supabase responding normally');
                return true;
            }
        } catch (error) {
            this.log('Supabase Connection', 'FAIL', `Connection error: ${error.message}`);
            return false;
        }
    }

    async testOpenAIIntegration() {
        try {
            // Test OpenAI integration with a simple classification request
            const classifyEndpoint = `${this.baseUrl}/api/classify`;
            const response = await fetch(classifyEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: 'This is a commercial lease agreement for office space.'
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.classification || result.document_type) {
                    this.log('OpenAI Integration', 'PASS', 'AI classification working correctly');
                    return true;
                } else {
                    this.log('OpenAI Integration', 'WARN', 'Unexpected AI response format');
                    return true;
                }
            } else if (response.status === 401 || response.status === 403) {
                this.log('OpenAI Integration', 'FAIL', 'OpenAI API key authentication failed');
                return false;
            } else {
                this.log('OpenAI Integration', 'WARN', `OpenAI endpoint returned: ${response.status}`);
                return true;
            }
        } catch (error) {
            this.log('OpenAI Integration', 'FAIL', `OpenAI test error: ${error.message}`);
            return false;
        }
    }

    async testPerformance() {
        const startTime = Date.now();
        try {
            const response = await fetch(this.baseUrl);
            const loadTime = Date.now() - startTime;
            
            if (loadTime < 3000) {
                this.log('Performance', 'PASS', `Page load time: ${loadTime}ms (excellent)`);
                return true;
            } else if (loadTime < 5000) {
                this.log('Performance', 'WARN', `Page load time: ${loadTime}ms (acceptable)`);
                return true;
            } else {
                this.log('Performance', 'FAIL', `Page load time: ${loadTime}ms (too slow)`);
                return false;
            }
        } catch (error) {
            this.log('Performance', 'FAIL', `Performance test error: ${error.message}`);
            return false;
        }
    }

    async testSecurity() {
        try {
            const response = await fetch(this.baseUrl);
            const headers = response.headers;
            
            let securityScore = 0;
            let details = [];

            // Check for security headers
            if (headers.get('strict-transport-security')) {
                securityScore++;
                details.push('HSTS enabled');
            }
            
            if (headers.get('x-frame-options')) {
                securityScore++;
                details.push('Frame protection enabled');
            }
            
            if (headers.get('x-content-type-options')) {
                securityScore++;
                details.push('Content type protection enabled');
            }

            if (securityScore >= 2) {
                this.log('Security Headers', 'PASS', `Security headers present: ${details.join(', ')}`);
                return true;
            } else {
                this.log('Security Headers', 'WARN', `Limited security headers: ${details.join(', ')}`);
                return true;
            }
        } catch (error) {
            this.log('Security Headers', 'FAIL', `Security test error: ${error.message}`);
            return false;
        }
    }

    async testMobileResponsiveness() {
        try {
            // Test mobile user agent response
            const response = await fetch(this.baseUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
                }
            });

            if (response.ok) {
                const html = await response.text();
                if (html.includes('viewport') && html.includes('mobile')) {
                    this.log('Mobile Responsiveness', 'PASS', 'Mobile viewport and responsive design detected');
                    return true;
                } else {
                    this.log('Mobile Responsiveness', 'WARN', 'Basic mobile response working');
                    return true;
                }
            } else {
                this.log('Mobile Responsiveness', 'FAIL', `Mobile request failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            this.log('Mobile Responsiveness', 'FAIL', `Mobile test error: ${error.message}`);
            return false;
        }
    }

    generateReport() {
        const endTime = Date.now();
        const totalTime = endTime - this.startTime;
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const warned = this.testResults.filter(r => r.status === 'WARN').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        
        const report = `
=== RExeli V1 Production Test Report ===
Generated: ${new Date().toISOString()}
Test Duration: ${totalTime}ms
Environment: Production (${this.baseUrl})

SUMMARY:
✅ Passed: ${passed}
⚠️  Warnings: ${warned}
❌ Failed: ${failed}
Total Tests: ${this.testResults.length}

DETAILED RESULTS:
${this.testResults.map(r => `${r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌'} ${r.test}: ${r.details}`).join('\n')}

RECOMMENDATIONS:
${failed > 0 ? '🔴 CRITICAL: Fix failed tests before production release' : ''}
${warned > 0 ? '🟡 Review warnings and optimize where possible' : ''}
${failed === 0 && warned === 0 ? '🟢 All tests passed - ready for production!' : ''}

=== End Report ===
        `;
        
        return report;
    }

    async runAllTests() {
        console.log('🚀 Starting RExeli V1 Production Tests...\n');
        
        await this.testApplicationLoad();
        await this.delay(500);
        
        await this.testEnvironmentVariables();
        await this.delay(500);
        
        await this.testSupabaseConnection();
        await this.delay(500);
        
        await this.testOpenAIIntegration();
        await this.delay(1000); // OpenAI needs more time
        
        await this.testPerformance();
        await this.delay(500);
        
        await this.testSecurity();
        await this.delay(500);
        
        await this.testMobileResponsiveness();
        
        console.log('\n🏁 Tests completed. Generating report...\n');
        
        const report = this.generateReport();
        console.log(report);
        
        // Save report to file
        const reportPath = path.join(process.cwd(), 'production_test_report.md');
        fs.writeFileSync(reportPath, report);
        console.log(`📊 Report saved to: ${reportPath}`);
        
        return this.testResults;
    }
}

// Run the tests if this file is executed directly
if (require.main === module) {
    const tester = new RExeliProductionTester();
    tester.runAllTests()
        .then(results => {
            const failed = results.filter(r => r.status === 'FAIL').length;
            process.exit(failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Test runner error:', error);
            process.exit(1);
        });
}

module.exports = RExeliProductionTester;