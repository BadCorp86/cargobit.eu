import client from 'prom-client';

/**
 * Prometheus Metrics for Reconciliation
 *
 * Metrics:
 * - reconciliation_runs_total: Counter for runs with result labels
 * - reconciliation_open_payouts_gauge: Current number of open payouts
 * - reconciliation_duration_seconds: Histogram for runtime
 * - reconciliation_diffs_found: Gauge for found differences
 * - reconciliation_errors_total: Counter for errors
 */
export class ReconciliationMetrics {
  // Counter: Total number of reconciliation runs
  reconciliationRuns = new client.Counter({
    name: 'reconciliation_runs_total',
    help: 'Total number of reconciliation runs',
    labelNames: ['result', 'namespace'],
  });

  // Gauge: Number of open payouts
  reconciliationOpen = new client.Gauge({
    name: 'reconciliation_open_payouts_gauge',
    help: 'Number of open payouts pending reconciliation',
    labelNames: ['status', 'namespace'],
  });

  // Histogram: Duration of reconciliation
  reconciliationDuration = new client.Histogram({
    name: 'reconciliation_duration_seconds',
    help: 'Duration of reconciliation runs in seconds',
    labelNames: ['namespace'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
  });

  // Gauge: Found differences
  reconciliationDiffs = new client.Gauge({
    name: 'reconciliation_diffs_found',
    help: 'Number of discrepancies found during reconciliation',
    labelNames: ['type', 'namespace'],
  });

  // Counter: Reconciliation errors
  reconciliationErrors = new client.Counter({
    name: 'reconciliation_errors_total',
    help: 'Total number of reconciliation errors',
    labelNames: ['error_type', 'namespace'],
  });

  // Counter: Manually marked payouts
  manualMarks = new client.Counter({
    name: 'reconciliation_manual_marks_total',
    help: 'Total number of manually marked payouts',
    labelNames: ['status', 'actor', 'namespace'],
  });

  // Gauge: Stripe API Latency
  stripeApiLatency = new client.Gauge({
    name: 'reconciliation_stripe_api_latency_seconds',
    help: 'Stripe API latency during reconciliation',
    labelNames: ['operation', 'namespace'],
  });

  // Counter: Processed payouts
  processedPayouts = new client.Counter({
    name: 'reconciliation_processed_payouts_total',
    help: 'Total number of processed payouts',
    labelNames: ['status_before', 'status_after', 'namespace'],
  });

  private namespace: string;

  constructor() {
    this.namespace = process.env.NAMESPACE || process.env.KUBERNETES_NAMESPACE || 'default';

    // Register default metrics
    try {
      client.collectDefaultMetrics({
        register: client.register,
        prefix: 'cargobit_',
      });
      console.log('Prometheus metrics initialized');
    } catch (error: any) {
      console.warn('Metrics already registered or error:', error?.message);
    }
  }

  /**
   * Record a successful run
   */
  recordSuccess(durationMs: number): void {
    this.reconciliationRuns.inc({ result: 'success', namespace: this.namespace });
    this.reconciliationDuration.observe({ namespace: this.namespace }, durationMs / 1000);
  }

  /**
   * Record a failed run
   */
  recordFailure(durationMs: number, errorType: string): void {
    this.reconciliationRuns.inc({ result: 'failure', namespace: this.namespace });
    this.reconciliationErrors.inc({ error_type: errorType, namespace: this.namespace });
    this.reconciliationDuration.observe({ namespace: this.namespace }, durationMs / 1000);
  }

  /**
   * Record a skipped run (already running)
   */
  recordSkipped(): void {
    this.reconciliationRuns.inc({ result: 'skipped', namespace: this.namespace });
  }

  /**
   * Update open payouts Gauge
   */
  setOpenPayouts(count: number, status: string): void {
    this.reconciliationOpen.set({ status, namespace: this.namespace }, count);
  }

  /**
   * Update differences Gauge
   */
  setDiffs(count: number, type: string = 'status_mismatch'): void {
    this.reconciliationDiffs.set({ type, namespace: this.namespace }, count);
  }

  /**
   * Record manual marking
   */
  recordManualMark(status: 'resolved' | 'needs_review', actorId: string): void {
    this.manualMarks.inc({ status, actor: actorId.substring(0, 20), namespace: this.namespace });
  }

  /**
   * Record Stripe API Latency
   */
  recordStripeLatency(operation: string, durationMs: number): void {
    this.stripeApiLatency.set({ operation, namespace: this.namespace }, durationMs / 1000);
  }

  /**
   * Record processed payout
   */
  recordProcessedPayout(statusBefore: string, statusAfter: string): void {
    this.processedPayouts.inc({
      status_before: statusBefore,
      status_after: statusAfter,
      namespace: this.namespace
    });
  }

  /**
   * Start timer for duration histogram
   */
  startTimer(): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.reconciliationDuration.observe({ namespace: this.namespace }, duration / 1000);
      return duration;
    };
  }

  /**
   * Get metrics output for /metrics endpoint
   */
  async getMetrics(): Promise<string> {
    return client.register.metrics();
  }

  /**
   * Get content type for HTTP response
   */
  getContentType(): string {
    return client.register.contentType;
  }
}

// Singleton for non-framework usage
let metricsInstance: ReconciliationMetrics | null = null;

export function getReconciliationMetrics(): ReconciliationMetrics {
  if (!metricsInstance) {
    metricsInstance = new ReconciliationMetrics();
  }
  return metricsInstance;
}
