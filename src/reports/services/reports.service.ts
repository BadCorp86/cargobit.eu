import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ExportJob, ExportJobPayload } from '../entities/export-job.entity';
import { ReportsMetricsService } from '../metrics/reports.metrics';

/**
 * Report List Result
 */
export interface ReportListResult {
  total: number;
  page: number;
  size: number;
  items: any[];
  summary?: {
    totalAmount: number;
    avgAmount: number;
  };
}

/**
 * Export Job Result
 */
export interface ExportJobResult {
  jobId: string;
  status: string;
  message: string;
}

/**
 * Reports Service
 * Handles reconciliation reporting and export job management
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ExportJob)
    private readonly jobsRepo: Repository<ExportJob>,
    private readonly metrics: ReportsMetricsService,
  ) {}

  /**
   * List reconciliation reports (mock implementation)
   * In production, this would query actual payout data
   */
  async listReports(opts: {
    page: number;
    size: number;
    filters?: {
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    };
  }): Promise<ReportListResult> {
    // In production, this would query the payouts table
    // For now, return mock data structure
    const mockItems = [];
    const total = 0;

    return {
      total,
      page: opts.page,
      size: opts.size,
      items: mockItems,
      summary: {
        totalAmount: 0,
        avgAmount: 0,
      },
    };
  }

  /**
   * Get summary statistics
   */
  async getSummary(opts: {
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    totalPayouts: number;
    totalAmount: number;
    byStatus: Record<string, number>;
    avgProcessingTime: number;
  }> {
    // In production, aggregate from payouts table
    return {
      totalPayouts: 0,
      totalAmount: 0,
      byStatus: {
        pending: 0,
        processing: 0,
        paid: 0,
        failed: 0,
      },
      avgProcessingTime: 0,
    };
  }

  /**
   * Enqueue an export job
   */
  async enqueueExport(payload: ExportJobPayload): Promise<ExportJobResult> {
    const jobId = uuidv4();

    const job = this.jobsRepo.create({
      id: jobId,
      payload,
      status: 'queued',
    });

    await this.jobsRepo.save(job);

    this.metrics.incrementExportsQueued();
    this.logger.log(`Export job ${jobId} enqueued with format ${payload.format || 'csv'}`);

    return {
      jobId,
      status: 'queued',
      message: 'Export job has been queued for processing',
    };
  }

  /**
   * Get export job status
   */
  async getExportJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    resultUrl?: string;
    error?: string;
    progress?: number;
  }> {
    const job = await this.jobsRepo.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException(`Export job ${jobId} not found`);
    }

    let progress = 0;
    if (job.status === 'running') {
      progress = 50;
    } else if (job.status === 'done') {
      progress = 100;
    } else if (job.status === 'failed') {
      progress = 0;
    }

    return {
      id: job.id,
      status: job.status,
      resultUrl: job.result_url,
      error: job.error,
      progress,
    };
  }

  /**
   * List export jobs
   */
  async listExportJobs(opts: {
    page: number;
    size: number;
    status?: string;
  }): Promise<{
    items: Array<{
      id: string;
      status: string;
      createdAt: Date;
      completedAt?: Date;
      resultUrl?: string;
    }>;
    total: number;
  }> {
    const where: any = {};
    if (opts.status) {
      where.status = opts.status;
    }

    const [jobs, total] = await this.jobsRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: opts.size,
      skip: (opts.page - 1) * opts.size,
    });

    return {
      items: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        resultUrl: job.result_url,
      })),
      total,
    };
  }

  /**
   * Mark job as running
   */
  async markJobRunning(jobId: string): Promise<void> {
    await this.jobsRepo.update(
      { id: jobId },
      {
        status: 'running',
        started_at: new Date(),
      },
    );
    this.metrics.incrementExportsRunning();
  }

  /**
   * Mark job as completed
   */
  async markJobDone(
    jobId: string,
    resultUrl: string,
    rowsExported: number,
    fileSize: string,
    durationMs: number,
  ): Promise<void> {
    await this.jobsRepo.update(
      { id: jobId },
      {
        status: 'done',
        result_url: resultUrl,
        rows_exported: rowsExported,
        file_size: fileSize,
        duration_ms: durationMs,
        completed_at: new Date(),
      },
    );
    this.metrics.incrementExportsCompleted();
    this.metrics.recordExportDuration(durationMs / 1000);
  }

  /**
   * Mark job as failed
   */
  async markJobFailed(jobId: string, error: string): Promise<void> {
    await this.jobsRepo.update(
      { id: jobId },
      {
        status: 'failed',
        error,
        completed_at: new Date(),
      },
    );
    this.metrics.incrementExportsFailed();
  }

  /**
   * Get next queued job for processing
   */
  async getNextQueuedJob(): Promise<ExportJob | null> {
    const job = await this.jobsRepo.findOne({
      where: { status: 'queued' },
      order: { created_at: 'ASC' },
    });
    return job;
  }
}
