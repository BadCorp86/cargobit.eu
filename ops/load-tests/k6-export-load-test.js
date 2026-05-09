/**
 * k6 Load Test Script for Export API
 * 
 * This k6 script tests the export API under various load conditions.
 * It measures throughput, latency percentiles, and error rates.
 * 
 * Prerequisites:
 *   - k6 installed (https://k6.io/docs/getting-started/installation/)
 *   - Valid ADMIN_JWT environment variable
 * 
 * Usage:
 *   k6 run -e BASE_URL=https://payments.staging.example.com -e ADMIN_JWT=eyJ... k6-export-load-test.js
 * 
 * For distributed load testing:
 *   k6 run --out influxdb=http://influxdb:8086/k6 -e BASE_URL=... -e ADMIN_JWT=... k6-export-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const exportSuccessRate = new Rate('export_success_rate');
const exportLatency = new Trend('export_latency');
const jobsEnqueued = new Counter('jobs_enqueued_total');
const jobsFailed = new Counter('jobs_failed_total');

// Configuration from environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_JWT = __ENV.ADMIN_JWT;

// Validate required environment variables
if (!ADMIN_JWT) {
  console.error('ERROR: ADMIN_JWT environment variable is required');
  console.error('Usage: k6 run -e ADMIN_JWT=your_jwt_here k6-export-load-test.js');
}

// Test configuration
export const options = {
  // Staged load test: ramp up, sustain, ramp down
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 VUs
    { duration: '1m', target: 10 },    // Stay at 10 VUs
    { duration: '30s', target: 30 },   // Ramp up to 30 VUs
    { duration: '2m', target: 30 },    // Stay at 30 VUs
    { duration: '30s', target: 50 },   // Ramp up to 50 VUs
    { duration: '3m', target: 50 },    // Stay at 50 VUs
    { duration: '1m', target: 0 },     // Ramp down
  ],
  
  // Thresholds for pass/fail
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests < 2s
    http_req_failed: ['rate<0.05'],     // < 5% error rate
    export_success_rate: ['rate>0.95'], // > 95% success rate
    export_latency: ['p(95)<1500'],     // 95% of exports < 1.5s
  },
  
  // Tag all requests with test metadata
  tags: {
    test_type: 'load_test',
    test_name: 'export_api',
  },
};

// Size profiles for test data
const SIZE_PROFILES = ['small', 'medium', 'large'];

// Default request params
const defaultParams = {
  headers: {
    'Authorization': `Bearer ${ADMIN_JWT}`,
    'Content-Type': 'application/json',
  },
  timeout: '30s',
};

/**
 * Generate export request payload with varying filters
 */
function generatePayload(vuId, iteration) {
  const profileIndex = (vuId + iteration) % SIZE_PROFILES.length;
  const sizeProfile = SIZE_PROFILES[profileIndex];
  
  // Vary date ranges to create different dataset sizes
  const dayOffset = (iteration % 30) + 1;
  const from = `2026-04-${String(dayOffset).padStart(2, '0')}`;
  const to = `2026-04-${String(Math.min(dayOffset + 7, 30)).padStart(2, '0')}`;
  
  return {
    format: iteration % 3 === 0 ? 'json' : 'csv', // Mix of formats
    filter: {
      sizeProfile,
      status: ['paid', 'pending', 'all'][iteration % 3],
      from,
      to,
    },
    metadata: {
      testRun: true,
      vuId,
      iteration,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Main test function - executed by each VU
 */
export default function () {
  const vuId = __VU;
  const iteration = __ITER;
  
  group('Export API Load Test', () => {
    // Generate payload for this iteration
    const payload = JSON.stringify(generatePayload(vuId, iteration));
    
    // Start timer
    const startTime = new Date();
    
    // Make export request
    const response = http.post(
      `${BASE_URL}/admin/reconciliation/report/export`,
      payload,
      defaultParams
    );
    
    // Calculate latency
    const latency = new Date() - startTime;
    exportLatency.add(latency);
    
    // Check response
    const success = check(response, {
      'status is 202 or 200': (r) => r.status === 202 || r.status === 200,
      'response has jobId': (r) => {
        try {
          const body = r.json();
          return body.jobId !== undefined;
        } catch {
          return false;
        }
      },
      'response time < 2000ms': (r) => r.timings.duration < 2000,
    });
    
    // Update metrics
    exportSuccessRate.add(success);
    
    if (success) {
      jobsEnqueued.add(1);
    } else {
      jobsFailed.add(1);
      console.error(`VU ${vuId} Iteration ${iteration}: Failed with status ${response.status}`);
    }
    
    // Log slow requests
    if (response.timings.duration > 1500) {
      console.warn(`VU ${vuId} Iteration ${iteration}: Slow response ${response.timings.duration}ms`);
    }
    
    // Think time between requests
    sleep(1);
  });
}

/**
 * Setup function - runs once before load test
 */
export function setup() {
  console.log('='.repeat(60));
  console.log('k6 Export API Load Test');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/health`, { timeout: '10s' });
  
  if (healthCheck.status !== 200) {
    console.error(`Health check failed: ${healthCheck.status}`);
    return { healthy: false };
  }
  
  console.log('Health check passed. Starting load test...');
  return { healthy: true };
}

/**
 * Teardown function - runs once after load test
 */
export function teardown(data) {
  console.log('='.repeat(60));
  console.log('Load Test Complete');
  console.log(`End Time: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
}

/**
 * Handle summary output - custom reporting
 */
export function handleSummary(data) {
  // Calculate summary statistics
  const httpReqs = data.metrics.http_reqs?.values?.count || 0;
  const httpReqDuration = data.metrics.http_req_duration?.values || {};
  const exportLatencyValues = data.metrics.export_latency?.values || {};
  const successRate = data.metrics.export_success_rate?.values?.rate || 0;
  
  const summary = `
╔════════════════════════════════════════════════════════════════╗
║                    LOAD TEST SUMMARY                           ║
╠════════════════════════════════════════════════════════════════╣
║ Total Requests:        ${String(httpReqs).padStart(8)}                          ║
║ Success Rate:          ${(successRate * 100).toFixed(2).padStart(8)}%                         ║
║                                                                ║
║ HTTP Request Duration (ms):                                    ║
║   Average:              ${String(Math.round(httpReqDuration.avg || 0)).padStart(8)}                          ║
║   P50:                  ${String(Math.round(httpReqDuration['p(50)'] || 0)).padStart(8)}                          ║
║   P95:                  ${String(Math.round(httpReqDuration['p(95)'] || 0)).padStart(8)}                          ║
║   P99:                  ${String(Math.round(httpReqDuration['p(99)'] || 0)).padStart(8)}                          ║
║                                                                ║
║ Export Latency (ms):                                           ║
║   Average:              ${String(Math.round(exportLatencyValues.avg || 0)).padStart(8)}                          ║
║   P50:                  ${String(Math.round(exportLatencyValues['p(50)'] || 0)).padStart(8)}                          ║
║   P95:                  ${String(Math.round(exportLatencyValues['p(95)'] || 0)).padStart(8)}                          ║
║                                                                ║
║ Thresholds:                                                    ║
║   P95 < 2000ms:         ${httpReqDuration['p(95)'] < 2000 ? '  PASS  ' : '  FAIL  '}                        ║
║   Error Rate < 5%:      ${(data.metrics.http_req_failed?.values?.rate || 0) < 0.05 ? '  PASS  ' : '  FAIL  '}                        ║
╚════════════════════════════════════════════════════════════════╝
`;

  console.log(summary);
  
  // Return both stdout and file output
  return {
    stdout: summary,
    'load-test-summary.json': JSON.stringify(data, null, 2),
  };
}
