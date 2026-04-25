// ============================================
// CARGOBIT RECONCILIATION EXPORT - ENQUEUE LOAD TEST
// Version: 1.0 - Simple Queue Stress Test
// ============================================

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Counter } from 'k6/metrics';

// ============================================
// METRICS
// ============================================

const enqueueSuccess = new Rate('enqueue_success');
const queueDepth = new Counter('queue_depth');

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = __ENV.ADMIN_JWT || '';
const BATCH_SIZE = parseInt(__ENV.BATCH_SIZE || '10');

// ============================================
// TEST OPTIONS
// ============================================

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    enqueue_success: ['rate>0.99'],
  },
};

// ============================================
// TEST FUNCTION
// ============================================

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JWT_TOKEN}`,
  };

  // Create multiple export jobs in quick succession
  for (let i = 0; i < BATCH_SIZE; i++) {
    const payload = JSON.stringify({
      format: i % 2 === 0 ? 'csv' : 'json',
      filter: {
        dateFrom: '2026-04-01',
        dateTo: '2026-04-25',
        status: i % 3 === 0 ? 'open' : 'all',
      },
    });

    const response = http.post(
      `${BASE_URL}/api/admin/reconciliation/report/export`,
      payload,
      { headers, tags: { batch: `${__VU}-${__ITER}`, item: i } }
    );

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

    enqueueSuccess.add(success);
    queueDepth.add(1);
  }

  sleep(1);
}

// ============================================
// TEARDOWN
// ============================================

export function teardown() {
  console.log('Enqueue load test completed');
}
