/**
 * CargoBit ML Inference Service - k6 Load Test Script
 * =====================================================
 * 
 * Load test scenarios for the ML Inference API:
 * - Ramp-up from 50 to 400 RPS
 * - P95 latency target: < 50ms for /score
 * - P95 latency target: < 200ms for /explain
 * 
 * Usage:
 *   k6 run k6_score_test.js
 *   k6 run --vus 50 --duration 5m k6_score_test.js
 *   k6 run --stage "2m:50,3m:200,5m:400" k6_score_test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// =============================================================================
// CUSTOM METRICS
// =============================================================================

// Error rate
const errorRate = new Rate('ml_inference_error_rate');

// Latency trends
const scoreLatency = new Trend('ml_score_latency_ms');
const explainLatency = new Trend('ml_explain_latency_ms');

// Request counters
const scoreRequests = new Counter('ml_score_requests_total');
const explainRequests = new Counter('ml_explain_requests_total');

// =============================================================================
// CONFIGURATION
// =============================================================================

// Base URL - can be overridden via environment variable
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// Test configuration
export let options = {
    // Load test stages
    stages: [
        // Warm-up: 2 minutes ramping to 50 RPS
        { duration: '2m', target: 50 },
        
        // Moderate load: 3 minutes at 200 RPS
        { duration: '3m', target: 200 },
        
        // Peak load: 5 minutes at 400 RPS
        { duration: '5m', target: 400 },
        
        // Cool-down: 2 minutes ramping down
        { duration: '2m', target: 0 },
    ],
    
    // Thresholds - these define pass/fail criteria
    thresholds: {
        // Overall error rate must be < 1%
        'ml_inference_error_rate': ['rate<0.01'],
        
        // Score endpoint: P95 < 50ms, P99 < 100ms
        'ml_score_latency_ms': ['p(95)<50', 'p(99)<100'],
        
        // Explain endpoint: P95 < 200ms, P99 < 500ms
        'ml_explain_latency_ms': ['p(95)<200', 'p(99)<500'],
        
        // HTTP request duration
        'http_req_duration': ['p(95)<100', 'p(99)<200'],
        
        // HTTP errors
        'http_req_failed': ['rate<0.01'],
    },
    
    // Tag all requests with test metadata
    tags: {
        test_type: 'load_test',
        service: 'ml-inference',
    },
};

// =============================================================================
// TEST DATA GENERATORS
// =============================================================================

/**
 * Generate random feature values for a suggestion
 */
function generateFeatures() {
    return {
        // Heuristic features
        heuristic_score: Math.floor(Math.random() * 100),
        distance_km: Math.round((Math.random() * 1000 + 10) * 100) / 100,
        price_per_km: Math.round((Math.random() * 5 + 0.5) * 100) / 100,
        vehicle_match_score: Math.floor(Math.random() * 100),
        
        // Context features
        hour_of_day: Math.floor(Math.random() * 24),
        day_of_week: Math.floor(Math.random() * 7),
        is_weekend: Math.random() > 0.7,
        is_peak_hour: Math.random() > 0.7,
        
        // Historical features
        driver_acceptance_rate_7d: Math.round(Math.random() * 100) / 100,
        driver_acceptance_rate_30d: Math.round(Math.random() * 100) / 100,
        driver_avg_response_time_min: Math.round(Math.random() * 60 * 100) / 100,
        driver_completed_jobs_30d: Math.floor(Math.random() * 100),
        carrier_reliability_score: Math.floor(Math.random() * 100),
        
        // Transport features
        transport_urgency_hours: Math.round(Math.random() * 72 * 100) / 100,
        cargo_weight_tons: Math.round(Math.random() * 25 * 100) / 100,
        requires_special_equipment: Math.random() > 0.8,
        is_international: Math.random() > 0.9,
        
        // Market features
        market_demand_score: Math.floor(Math.random() * 100),
        competitor_price_avg: Math.round((Math.random() * 1000 + 100) * 100) / 100,
        fuel_price_index: Math.round((Math.random() * 2 + 1) * 100) / 100,
        
        // Meta features
        suggestion_position: Math.floor(Math.random() * 10),
        num_competing_suggestions: Math.floor(Math.random() * 20),
        price_rank_in_suggestions: Math.floor(Math.random() * 10) + 1,
    };
}

/**
 * Generate a score request with multiple suggestions
 */
function generateScoreRequest() {
    const numSuggestions = Math.floor(Math.random() * 5) + 1; // 1-5 suggestions
    const suggestions = [];
    
    for (let i = 0; i < numSuggestions; i++) {
        suggestions.push(generateFeatures());
    }
    
    return {
        transport_id: `transport_${Math.floor(Math.random() * 1000000)}`,
        suggestions: suggestions,
        return_heuristic: true,
        alpha: 0.8,
    };
}

/**
 * Generate an explain request
 */
function generateExplainRequest() {
    return {
        features: generateFeatures(),
        top_k: 5,
        include_baseline: false,
    };
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

/**
 * Main test function - called for each virtual user iteration
 */
export default function () {
    // Randomly choose between score (80%) and explain (20%) endpoints
    // This matches realistic production traffic patterns
    const runExplain = Math.random() < 0.2;
    
    if (runExplain) {
        testExplainEndpoint();
    } else {
        testScoreEndpoint();
    }
    
    // Small sleep between requests (think time)
    sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

/**
 * Test the /score endpoint
 */
function testScoreEndpoint() {
    const url = `${BASE_URL}/score`;
    const payload = JSON.stringify(generateScoreRequest());
    
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        tags: { endpoint: 'score' },
    };
    
    const startTime = new Date();
    const response = http.post(url, payload, params);
    const latency = new Date() - startTime;
    
    // Record custom metrics
    scoreLatency.add(latency);
    scoreRequests.add(1);
    
    // Validate response
    const success = check(response, {
        'score: status is 200': (r) => r.status === 200,
        'score: has transport_id': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.transport_id !== undefined;
            } catch (e) {
                return false;
            }
        },
        'score: has scored_suggestions': (r) => {
            try {
                const body = JSON.parse(r.body);
                return Array.isArray(body.scored_suggestions) && 
                       body.scored_suggestions.length > 0;
            } catch (e) {
                return false;
            }
        },
        'score: scores are valid': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.scored_suggestions.every(s => 
                    s.ml_score >= 0 && s.ml_score <= 1 &&
                    s.final_score >= 0 && s.final_score <= 1
                );
            } catch (e) {
                return false;
            }
        },
        'score: latency < 100ms': () => latency < 100,
    });
    
    // Record error rate
    errorRate.add(!success);
    
    if (!success) {
        console.log(`Score endpoint failed: status=${response.status}, latency=${latency}ms`);
    }
}

/**
 * Test the /explain endpoint
 */
function testExplainEndpoint() {
    const url = `${BASE_URL}/explain`;
    const payload = JSON.stringify(generateExplainRequest());
    
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        tags: { endpoint: 'explain' },
    };
    
    const startTime = new Date();
    const response = http.post(url, payload, params);
    const latency = new Date() - startTime;
    
    // Record custom metrics
    explainLatency.add(latency);
    explainRequests.add(1);
    
    // Validate response
    const success = check(response, {
        'explain: status is 200': (r) => r.status === 200,
        'explain: has predicted_score': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.predicted_score !== undefined;
            } catch (e) {
                return false;
            }
        },
        'explain: has baseline_value': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body.baseline_value !== undefined;
            } catch (e) {
                return false;
            }
        },
        'explain: has contributors': (r) => {
            try {
                const body = JSON.parse(r.body);
                return Array.isArray(body.top_positive_contributors) &&
                       Array.isArray(body.top_negative_contributors);
            } catch (e) {
                return false;
            }
        },
        'explain: latency < 500ms': () => latency < 500,
    });
    
    // Record error rate
    errorRate.add(!success);
    
    if (!success) {
        console.log(`Explain endpoint failed: status=${response.status}, latency=${latency}ms`);
    }
}

// =============================================================================
// SETUP AND TEARDOWN
// =============================================================================

/**
 * Setup function - runs once before the test
 */
export function setup() {
    console.log('Starting ML Inference Service load test...');
    console.log(`Target URL: ${BASE_URL}`);
    
    // Health check before starting
    const healthUrl = `${BASE_URL}/health`;
    const healthResponse = http.get(healthUrl);
    
    if (healthResponse.status !== 200) {
        console.log('WARNING: Health check failed - service may not be ready');
    } else {
        console.log('Health check passed - service is ready');
    }
    
    return { startTime: new Date().toISOString() };
}

/**
 * Teardown function - runs once after the test
 */
export function teardown(data) {
    console.log(`Load test completed. Started at: ${data.startTime}`);
    
    // Final health check
    const healthUrl = `${BASE_URL}/health`;
    const healthResponse = http.get(healthUrl);
    console.log(`Final health check status: ${healthResponse.status}`);
}

// =============================================================================
// ADDITIONAL TEST SCENARIOS (Optional)
// =============================================================================

/**
 * Stress test scenario - sustained high load
 * Run with: k6 run --scenario stress k6_score_test.js
 */
export const scenarios = {
    // Default load test
    load_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '2m', target: 50 },
            { duration: '3m', target: 200 },
            { duration: '5m', target: 400 },
            { duration: '2m', target: 0 },
        ],
        gracefulRampDown: '30s',
    },
    
    // Spike test - sudden load increase
    spike_test: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
            { duration: '10s', target: 100 },
            { duration: '30s', target: 500 },
            { duration: '10s', target: 0 },
        ],
        gracefulRampDown: '10s',
        exec: 'spikeTest',
    },
    
    // Soak test - extended moderate load
    soak_test: {
        executor: 'constant-vus',
        vus: 100,
        duration: '30m',
        exec: 'soakTest',
    },
};

/**
 * Spike test function
 */
export function spikeTest() {
    testScoreEndpoint();
    sleep(0.05); // Minimal sleep for spike testing
}

/**
 * Soak test function
 */
export function soakTest() {
    // Mix of score and explain requests
    if (Math.random() < 0.1) {
        testExplainEndpoint();
    } else {
        testScoreEndpoint();
    }
    sleep(Math.random() + 0.5); // Longer sleep for soak testing
}
