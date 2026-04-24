// ============================================
// CARGOBIT RECONCILIATION EXPORT - ENQUEUE LOAD TEST (Parameterized)
// Version: 1.0 - CI/CD Ready
// ============================================

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// ============================================
// METRICS
// ============================================

const enqueueSuccess = new Rate('enqueue_success');
const enqueueLatency = new Trend('enqueue_latency');
const queueDepth = new Counter('queue_depth');
const rateLimited = new Counter('rate_limited');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  jwtToken: __ENV.ADMIN_JWT || '',
  
  // Test parameters
  vuCount: parseInt(__ENV.VUS || '20'),
  duration: __ENV.DURATION || '2m',
  batchSize: parseInt(__ENV.BATCH_SIZE || '5'),
  
  // Thresholds
  p95Latency: parseInt(__ENV.P95_LATENCY || '500'),
  errorRateThreshold: parseFloat(__ENV.ERROR_RATE || '0.01'),
};

// ============================================
// TEST OPTIONS
// ============================================

export const options = {
  stages: [
    { duration: '30s', target: CONFIG.vuCount },
    { duration: CONFIG.duration, target: CONFIG.vuCount },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: [`p(95)<${CONFIG.p95Latency}`],
    http_req_failed: [`rate<${CONFIG.errorRateThreshold}`],
    enqueue_success: ['rate>0.99'],
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateJobPayload(index) {
  const formats = ['csv', 'json'];
  const statuses = ['open', 'reconciled', 'needs_review', ''];
  
  return JSON.stringify({
    format: formats[index % formats.length],
    filter: {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-25',
      status: statuses[index % statuses.length] || undefined,
    },
  });
}

// ============================================
// TEST FUNCTION
// ============================================

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.jwtToken}`,
  };

  // Create batch of export jobs
  for (let i = 0; i < CONFIG.batchSize; i++) {
    const payload = generateJobPayload(i);

    const response = http.post(
      `${CONFIG.baseUrl}/api/admin/reconciliation/report/export`,
      payload,
      { 
        headers, 
        tags: { 
          batch: `${__VU}-${__ITER}`, 
          item: i,
          format: i % 2 === 0 ? 'csv' : 'json',
        } 
      }
    );

    enqueueLatency.add(response.timings.duration);

    const success = check(response, {
      'status is 202': (r) => r.status === 202,
      'has jobId': (r) => {
        try {
          return r.json('jobId') !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (success) {
      enqueueSuccess.add(1);
      queueDepth.add(1);
    } else {
      enqueueSuccess.add(0);
      
      if (response.status === 429) {
        rateLimited.add(1);
        console.log(`Rate limited at VU ${__VU}, iteration ${__ITER}`);
      }
    }
  }

  sleep(1);
}

// ============================================
// SETUP & TEARDOWN
// ============================================

export function setup() {
  console.log(`
========================================
ENQUEUE LOAD TEST
========================================
Base URL: ${CONFIG.baseUrl}
VUs: ${CONFIG.vuCount}
Duration: ${CONFIG.duration}
Batch Size: ${CONFIG.batchSize}
P95 Threshold: ${CONFIG.p95Latency}ms
========================================
  `);
  
  // Verify authentication
  const response = http.get(
    `${CONFIG.baseUrl}/api/health`,
    { headers: { 'Authorization': `Bearer ${CONFIG.jwtToken}` } }
  );
  
  if (response.status !== 200) {
    console.error(`Health check failed: ${response.status}`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`
========================================
TEST COMPLETED
========================================
Total Duration: ${duration.toFixed(2)}s
========================================
  `);
}
