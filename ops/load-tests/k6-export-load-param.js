// ============================================
// CARGOBIT RECONCILIATION EXPORT - K6 LOAD TEST
// Version: 1.0 - Parameterized for CI/CD
// ============================================

import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

// ============================================
// CUSTOM METRICS
// ============================================

const exportSuccessRate = new Rate('export_success');
const exportErrorRate = new Rate('export_error');
const exportLatency = new Trend('export_latency');
const downloadLatency = new Trend('download_latency');
const queuedJobs = new Counter('queued_jobs');
const completedJobs = new Counter('completed_jobs');
const failedJobs = new Counter('failed_jobs');

// ============================================
// CONFIGURATION - Environment Variables
// ============================================

const CONFIG = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:3000',
  jwtToken: __ENV.ADMIN_JWT || '',
  apiKey: __ENV.API_KEY || 'test-api-key',
  
  // Test Parameters
  vuCount: parseInt(__ENV.VUS || '10'),
  duration: __ENV.DURATION || '2m',
  rampUp: __ENV.RAMP_UP || '30s',
  
  // Export Parameters
  formats: (__ENV.FORMATS || 'csv,json').split(','),
  maxPollAttempts: parseInt(__ENV.MAX_POLL_ATTEMPTS || '12'),
  pollInterval: parseInt(__ENV.POLL_INTERVAL || '5'),
  
  // Thresholds
  p95Latency: parseInt(__ENV.P95_LATENCY || '2000'),
  errorRateThreshold: parseFloat(__ENV.ERROR_RATE || '0.01'),
};

// Validate required config
if (!CONFIG.jwtToken) {
  console.error('ERROR: ADMIN_JWT environment variable is required');
}

// ============================================
// TEST DATA
// ============================================

const DATE_RANGES = [
  { from: '2026-04-01', to: '2026-04-07' },
  { from: '2026-04-08', to: '2026-04-14' },
  { from: '2026-04-15', to: '2026-04-21' },
  { from: '2026-04-22', to: '2026-04-25' },
];

const FILTER_SCENARIOS = [
  { status: 'open' },
  { status: 'reconciled' },
  { status: 'needs_review' },
  {}, // No filter
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRequestId() {
  return `req-${__VU}-${__ITER}-${Date.now()}`;
}

function getDefaultHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CONFIG.jwtToken}`,
    'X-Request-ID': generateRequestId(),
  };
}

// ============================================
// EXPORT API FUNCTIONS
// ============================================

function createExportJob(format = 'csv', filter = {}) {
  const payload = JSON.stringify({
    format,
    filter,
  });

  const response = http.post(
    `${CONFIG.baseUrl}/api/admin/reconciliation/report/export`,
    payload,
    { headers: getDefaultHeaders(), tags: { operation: 'create_export' } }
  );

  exportLatency.add(response.timings.duration);

  const success = check(response, {
    'create_export: status is 202': (r) => r.status === 202,
    'create_export: has jobId': (r) => {
      try {
        const body = r.json();
        return body.jobId !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    const body = response.json();
    queuedJobs.add(1);
    return body.jobId;
  } else {
    exportErrorRate.add(1);
    console.error(`Failed to create export job: ${response.status} ${response.body}`);
    return null;
  }
}

function getExportJobStatus(jobId) {
  const response = http.get(
    `${CONFIG.baseUrl}/api/admin/reconciliation/report/export/${jobId}`,
    { headers: getDefaultHeaders(), tags: { operation: 'get_status' } }
  );

  const success = check(response, {
    'get_status: status is 200': (r) => r.status === 200,
    'get_status: has status field': (r) => {
      try {
        const body = r.json();
        return body.status !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    return response.json();
  }
  return null;
}

function waitForExportCompletion(jobId) {
  for (let i = 0; i < CONFIG.maxPollAttempts; i++) {
    const job = getExportJobStatus(jobId);
    
    if (!job) {
      sleep(CONFIG.pollInterval);
      continue;
    }

    if (job.status === 'completed') {
      completedJobs.add(1);
      return job;
    }

    if (job.status === 'failed') {
      failedJobs.add(1);
      console.error(`Export job ${jobId} failed`);
      return null;
    }

    sleep(CONFIG.pollInterval);
  }

  console.error(`Export job ${jobId} timed out after ${CONFIG.maxPollAttempts} polls`);
  return null;
}

function downloadExport(downloadUrl) {
  const response = http.get(downloadUrl, {
    headers: getDefaultHeaders(),
    tags: { operation: 'download' },
  });

  downloadLatency.add(response.timings.duration);

  const success = check(response, {
    'download: status is 200': (r) => r.status === 200,
    'download: has content': (r) => r.body && r.body.length > 0,
  });

  if (success) {
    exportSuccessRate.add(1);
  } else {
    exportErrorRate.add(1);
  }

  return success;
}

// ============================================
// TEST SCENARIOS
// ============================================

// Scenario 1: Export Creation Only (No Polling)
export const createOnlyOptions = {
  stages: [
    { duration: CONFIG.rampUp, target: CONFIG.vuCount },
    { duration: CONFIG.duration, target: CONFIG.vuCount },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: [`p(95)<${CONFIG.p95Latency}`],
    http_req_failed: [`rate<${CONFIG.errorRateThreshold}`],
    export_error: ['rate<0.02'],
  },
};

export function createOnly() {
  const format = getRandomElement(CONFIG.formats);
  const dateRange = getRandomElement(DATE_RANGES);
  const filter = {
    ...getRandomElement(FILTER_SCENARIOS),
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  };

  group('Create Export Job', () => {
    const jobId = createExportJob(format, filter);
    check(jobId, { 'job created': (id) => id !== null });
  });

  sleep(1);
}

// Scenario 2: Full Export Flow (Create + Poll + Download)
export const fullFlowOptions = {
  stages: [
    { duration: CONFIG.rampUp, target: Math.min(CONFIG.vuCount, 5) }, // Lower VUs for full flow
    { duration: CONFIG.duration, target: Math.min(CONFIG.vuCount, 5) },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: [`p(95)<${CONFIG.p95Latency}`],
    http_req_failed: [`rate<${CONFIG.errorRateThreshold}`],
    export_error: ['rate<0.02'],
    export_success: ['rate>0.95'],
  },
};

export function fullFlow() {
  const format = getRandomElement(CONFIG.formats);
  
  group('Full Export Flow', () => {
    // Step 1: Create export job
    const jobId = createExportJob(format);
    
    if (!jobId) {
      exportErrorRate.add(1);
      return;
    }

    // Step 2: Wait for completion
    const job = waitForExportCompletion(jobId);
    
    if (!job) {
      exportErrorRate.add(1);
      return;
    }

    // Step 3: Download export
    if (job.downloadUrl) {
      downloadExport(job.downloadUrl);
    }
  });

  sleep(2);
}

// Scenario 3: Concurrent Export Requests
export const concurrentOptions = {
  scenarios: {
    concurrent_exports: {
      executor: 'per-vu-iterations',
      vus: CONFIG.vuCount,
      iterations: 10,
      maxDuration: CONFIG.duration,
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${CONFIG.p95Latency}`],
    export_error: ['rate<0.02'],
  },
};

export function concurrent() {
  const format = getRandomElement(CONFIG.formats);
  createExportJob(format);
  sleep(0.5);
}

// Scenario 4: Burst Load
export const burstOptions = {
  stages: [
    { duration: '10s', target: 50 },   // Quick ramp up
    { duration: '30s', target: 50 },   // Burst
    { duration: '10s', target: 5 },    // Drop
    { duration: '1m', target: 5 },     // Normal load
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // Higher threshold for burst
    http_req_failed: ['rate<0.05'],
    export_error: ['rate<0.05'],
  },
};

export function burst() {
  const format = getRandomElement(CONFIG.formats);
  createExportJob(format);
  sleep(0.1);
}

// Scenario 5: Mixed Operations
export const mixedOptions = {
  scenarios: {
    create_exports: {
      executor: 'constant-vus',
      vus: Math.ceil(CONFIG.vuCount * 0.7),
      duration: CONFIG.duration,
      exec: 'createOnly',
    },
    full_flows: {
      executor: 'constant-vus',
      vus: Math.ceil(CONFIG.vuCount * 0.3),
      duration: CONFIG.duration,
      exec: 'fullFlow',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${CONFIG.p95Latency}`],
    export_error: ['rate<0.02'],
  },
};

// ============================================
// SCENARIO SELECTION
// ============================================

const SCENARIO = __ENV.SCENARIO || 'create-only';

let options, defaultFn;

switch (SCENARIO) {
  case 'full-flow':
    options = fullFlowOptions;
    defaultFn = fullFlow;
    break;
  case 'concurrent':
    options = concurrentOptions;
    defaultFn = concurrent;
    break;
  case 'burst':
    options = burstOptions;
    defaultFn = burst;
    break;
  case 'mixed':
    options = mixedOptions;
    defaultFn = createOnly; // Mixed uses scenario definitions
    break;
  default:
    options = createOnlyOptions;
    defaultFn = createOnly;
}

export { options };
export default defaultFn;

// ============================================
// TEARDOWN
// ============================================

export function teardown() {
  console.log(`
========================================
EXPORT LOAD TEST COMPLETED
========================================
Scenario: ${SCENARIO}
VUs: ${CONFIG.vuCount}
Duration: ${CONFIG.duration}
Base URL: ${CONFIG.baseUrl}
========================================
  `);
}
