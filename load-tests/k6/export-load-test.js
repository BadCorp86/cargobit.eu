/**
 * CargoBit Export Load Test Suite
 * Initiative 4: Ops Load Test Plan for Large Exports and Multipart S3 Flow
 * 
 * Run with: k6 run load-tests/k6/export-load-test.js
 * 
 * Test Profiles:
 * - small: 100k rows (~10MB)
 * - medium: 1M rows (~100MB)
 * - large: 10M rows (~1GB)
 * - xlarge: 50M rows (~5GB)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';
const TEST_PROFILE = __ENV.TEST_PROFILE || 'medium'; // small, medium, large, xlarge
const CONCURRENCY = parseInt(__ENV.CONCURRENCY || '3');

// Custom Metrics
const exportDuration = new Trend('export_duration_seconds');
const exportSuccessRate = new Rate('export_success_rate');
const exportQueueTime = new Trend('export_queue_time_seconds');
const downloadDuration = new Trend('download_duration_seconds');
const memoryUsage = new Gauge('worker_memory_mb');
const multipartParts = new Counter('multipart_parts_total');

// Test Profiles
const PROFILES = {
    small: {
        rows: 100000,
        expectedSizeMB: 10,
        maxDuration: 60,  // 1 minute
        timeout: 120,
    },
    medium: {
        rows: 1000000,
        expectedSizeMB: 100,
        maxDuration: 300,  // 5 minutes
        timeout: 600,
    },
    large: {
        rows: 10000000,
        expectedSizeMB: 1000,
        maxDuration: 1800,  // 30 minutes
        timeout: 3600,
    },
    xlarge: {
        rows: 50000000,
        expectedSizeMB: 5000,
        maxDuration: 3600,  // 1 hour
        timeout: 7200,
    },
};

const profile = PROFILES[TEST_PROFILE];

// =============================================================================
// OPTIONS
// =============================================================================

export const options = {
    scenarios: {
        // Scenario 1: Single large export
        single_large_export: {
            executor: 'per-vu-iterations',
            vus: 1,
            iterations: 1,
            maxDuration: `${profile.timeout}s`,
            exec: 'testSingleExport',
            tags: { test_type: 'single_export', profile: TEST_PROFILE },
        },
        // Scenario 2: Concurrent exports
        concurrent_exports: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: CONCURRENCY },
                { duration: '2m', target: CONCURRENCY },
                { duration: '30s', target: 0 },
            ],
            exec: 'testConcurrentExport',
            tags: { test_type: 'concurrent_export', profile: TEST_PROFILE },
            startTime: `${profile.timeout + 60}s`,  // Start after single export
        },
        // Scenario 3: Burst test
        burst_test: {
            executor: 'shared-iterations',
            vus: 10,
            iterations: 20,
            maxDuration: '5m',
            exec: 'testBurstExport',
            tags: { test_type: 'burst', profile: 'small' },
            startTime: `${profile.timeout + 300}s`,  // Start after concurrent test
        },
    },
    thresholds: {
        'export_duration_seconds': [`p(95)<${profile.maxDuration}`],
        'export_success_rate': ['rate>0.95'],
        'export_queue_time_seconds': ['p(95)<30'],
        'http_req_duration': ['p(95)<5000'],
        'http_req_failed': ['rate<0.05'],
    },
};

// =============================================================================
// SETUP
// =============================================================================

export function setup() {
    console.log(`Starting export load test with profile: ${TEST_PROFILE}`);
    console.log(`Expected rows: ${profile.rows.toLocaleString()}`);
    console.log(`Expected size: ~${profile.expectedSizeMB}MB`);
    console.log(`Max duration: ${profile.maxDuration}s`);

    // Verify test data exists
    const checkData = http.get(`${BASE_URL}/api/admin/reconciliation/stats`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });

    check(checkData, {
        'test data available': (r) => r.status === 200,
    });

    return {
        startTime: Date.now(),
        profile: TEST_PROFILE,
    };
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

export function testSingleExport(data) {
    group('Single Large Export', () => {
        const startTime = Date.now();

        // 1. Initiate export
        const exportPayload = JSON.stringify({
            format: 'csv',
            filters: {
                status: 'all',
                minRows: profile.rows,
            },
            includeScores: true,
        });

        const exportResponse = http.post(
            `${BASE_URL}/api/admin/reconciliation/report/export`,
            exportPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
                timeout: `${profile.timeout}s`,
            }
        );

        check(exportResponse, {
            'export initiated': (r) => r.status === 201 || r.status === 202,
            'job id returned': (r) => {
                const body = JSON.parse(r.body);
                return body.data?.jobId || body.jobId;
            },
        });

        if (exportResponse.status >= 400) {
            console.error('Failed to initiate export:', exportResponse.body);
            exportSuccessRate.add(0);
            return;
        }

        const jobId = JSON.parse(exportResponse.body).data?.jobId || 
                       JSON.parse(exportResponse.body).jobId;

        // 2. Poll for completion
        const queueStartTime = Date.now();
        let jobStatus = 'pending';
        let resultUrl = null;

        while (jobStatus === 'pending' || jobStatus === 'running') {
            sleep(5);  // Poll every 5 seconds

            const statusResponse = http.get(
                `${BASE_URL}/api/admin/reconciliation/report/export/${jobId}`,
                {
                    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
                }
            );

            if (statusResponse.status === 200) {
                const body = JSON.parse(statusResponse.body);
                jobStatus = body.data?.status || body.status;
                resultUrl = body.data?.resultUrl || body.result_url;

                // Track queue time
                if (jobStatus === 'running' || jobStatus === 'done') {
                    exportQueueTime.add((Date.now() - queueStartTime) / 1000);
                }

                console.log(`Job ${jobId} status: ${jobStatus}`);
            }

            // Timeout check
            if ((Date.now() - startTime) / 1000 > profile.timeout) {
                console.error('Export timeout exceeded');
                break;
            }
        }

        // 3. Verify completion
        const totalDuration = (Date.now() - startTime) / 1000;
        exportDuration.add(totalDuration);

        check(jobStatus, {
            'export completed': (s) => s === 'done' || s === 'completed',
            'within time limit': () => totalDuration <= profile.maxDuration,
        });

        exportSuccessRate.add(jobStatus === 'done' ? 1 : 0);

        // 4. Test download if available
        if (resultUrl) {
            const downloadStart = Date.now();

            const downloadResponse = http.get(resultUrl, {
                timeout: '300s',
            });

            downloadDuration.add((Date.now() - downloadStart) / 1000);

            check(downloadResponse, {
                'download successful': (r) => r.status === 200,
                'file size reasonable': (r) => {
                    const contentLength = r.headers['Content-Length'];
                    const sizeMB = contentLength ? parseInt(contentLength) / (1024 * 1024) : 0;
                    console.log(`Downloaded file size: ${sizeMB.toFixed(2)}MB`);
                    return sizeMB > 0;
                },
            });
        }

        console.log(`Single export completed in ${totalDuration.toFixed(2)}s`);
    });
}

export function testConcurrentExport(data) {
    group('Concurrent Exports', () => {
        const startTime = Date.now();

        // Initiate export with smaller size for concurrency test
        const exportPayload = JSON.stringify({
            format: 'csv',
            filters: {
                status: 'all',
                minRows: 100000,  // Smaller for concurrent test
            },
        });

        const exportResponse = http.post(
            `${BASE_URL}/api/admin/reconciliation/report/export`,
            exportPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
            }
        );

        const success = check(exportResponse, {
            'concurrent export initiated': (r) => r.status === 201 || r.status === 202 || r.status === 429,
        });

        if (exportResponse.status === 429) {
            console.log('Rate limited - expected behavior under high load');
        }

        exportSuccessRate.add(success ? 1 : 0);

        // Wait for completion with shorter timeout
        if (success && exportResponse.status !== 429) {
            const jobId = JSON.parse(exportResponse.body).data?.jobId ||
                          JSON.parse(exportResponse.body).jobId;

            let jobStatus = 'pending';
            const maxWait = 300; // 5 minutes for concurrent test

            while ((jobStatus === 'pending' || jobStatus === 'running') && 
                   (Date.now() - startTime) / 1000 < maxWait) {
                sleep(3);

                const statusResponse = http.get(
                    `${BASE_URL}/api/admin/reconciliation/report/export/${jobId}`,
                    {
                        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
                    }
                );

                if (statusResponse.status === 200) {
                    const body = JSON.parse(statusResponse.body);
                    jobStatus = body.data?.status || body.status;
                }
            }

            const duration = (Date.now() - startTime) / 1000;
            exportDuration.add(duration);

            check(jobStatus, {
                'concurrent export completed': (s) => s === 'done' || s === 'completed',
            });
        }
    });
}

export function testBurstExport(data) {
    group('Burst Export Test', () => {
        // Rapid small exports to test queue handling
        const exportPayload = JSON.stringify({
            format: 'csv',
            filters: {
                status: 'reconciled',
                minRows: 10000,  // Very small for burst test
            },
        });

        const response = http.post(
            `${BASE_URL}/api/admin/reconciliation/report/export`,
            exportPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${ADMIN_TOKEN}`,
                },
            }
        );

        const success = check(response, {
            'burst export accepted': (r) => r.status < 500,
        });

        exportSuccessRate.add(success ? 1 : 0);

        if (response.status === 429) {
            console.log('Rate limited during burst - expected');
        }
    });
}

// =============================================================================
// TEARDOWN
// =============================================================================

export function teardown(data) {
    const totalDuration = (Date.now() - data.startTime) / 1000;
    console.log(`\n=== Load Test Summary ===`);
    console.log(`Profile: ${data.profile}`);
    console.log(`Total Duration: ${totalDuration.toFixed(2)}s`);
    console.log(`Concurrent VUs: ${CONCURRENCY}`);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateTestId() {
    return `loadtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
