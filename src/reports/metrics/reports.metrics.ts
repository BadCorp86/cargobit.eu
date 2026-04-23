import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, register } from 'prom-client';

/**
 * Reports Metrics Service
 * Provides Prometheus metrics for export jobs
 */
@Injectable()
export class ReportsMetricsService {
  // Counter for total exports queued
  private exportsQueued: Counter<string>;

  // Counter for exports currently running
  private exportsRunning: Gauge<string>;

  // Counter for completed exports
  private exportsCompleted: Counter<string>;

  // Counter for failed exports
  private exportsFailed: Counter<string>;

  // Histogram for export duration
  private exportDuration: Histogram<string>;

  // Gauge for exports in progress
  private exportsInProgress: Gauge<string>;

  constructor() {
    // Initialize metrics with default labels
    const defaultLabels = { service: 'reports-service' };

    this.exportsQueued = new Counter({
      name: 'report_exports_queued_total',
      help: 'Total number of export jobs queued',
      labelNames: ['format'],
    });

    this.exportsRunning = new Gauge({
      name: 'report_exports_running',
      help: 'Number of export jobs currently running',
    });

    this.exportsCompleted = new Counter({
      name: 'report_exports_completed_total',
      help: 'Total number of completed export jobs',
      labelNames: ['format'],
    });

    this.exportsFailed = new Counter({
      name: 'report_exports_failed_total',
      help: 'Total number of failed export jobs',
      labelNames: ['error_type'],
    });

    this.exportDuration = new Histogram({
      name: 'report_export_duration_seconds',
      help: 'Duration of export jobs in seconds',
      labelNames: ['format'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    });

    this.exportsInProgress = new Gauge({
      name: 'report_export_in_progress',
      help: 'Number of export jobs currently in progress',
    });
  }

  /**
   * Increment exports queued counter
   */
  incrementExportsQueued(format: string = 'csv'): void {
    this.exportsQueued.inc({ format });
  }

  /**
   * Increment running gauge
   */
  incrementExportsRunning(): void {
    this.exportsRunning.inc();
    this.exportsInProgress.inc();
  }

  /**
   * Decrement running gauge
   */
  decrementExportsRunning(): void {
    this.exportsRunning.dec();
    this.exportsInProgress.dec();
  }

  /**
   * Increment completed exports counter
   */
  incrementExportsCompleted(format: string = 'csv'): void {
    this.exportsCompleted.inc({ format });
    this.decrementExportsRunning();
  }

  /**
   * Increment failed exports counter
   */
  incrementExportsFailed(errorType: string = 'unknown'): void {
    this.exportsFailed.inc({ error_type: errorType });
    this.decrementExportsRunning();
  }

  /**
   * Record export duration
   */
  recordExportDuration(durationSeconds: number, format: string = 'csv'): void {
    this.exportDuration.observe({ format }, durationSeconds);
  }

  /**
   * Get metrics for /metrics endpoint
   */
  getMetrics(): string {
    return register.metrics();
  }
}
