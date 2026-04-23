import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReportsService, ReportListResult, ExportJobResult } from '../services/reports.service';
import { AdminAuthGuard } from '../../auth/admin-auth.guard';
import { ExportJobPayload } from '../entities/export-job.entity';

/**
 * Reports Controller
 * Provides API endpoints for reconciliation reporting and export
 */
@Controller('admin/reconciliation/report')
@UseGuards(AdminAuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  /**
   * GET /admin/reconciliation/report
   * List reconciliation reports with pagination
   */
  @Get()
  async listReports(
    @Query('page') page = '1',
    @Query('size') size = '50',
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<ReportListResult> {
    return this.svc.listReports({
      page: Number(page),
      size: Math.min(Number(size), 500),
      filters: { status, dateFrom, dateTo },
    });
  }

  /**
   * GET /admin/reconciliation/report/summary
   * Get aggregated summary statistics
   */
  @Get('summary')
  async getSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<{
    totalPayouts: number;
    totalAmount: number;
    byStatus: Record<string, number>;
    avgProcessingTime: number;
  }> {
    return this.svc.getSummary({ dateFrom, dateTo });
  }

  /**
   * POST /admin/reconciliation/report/export
   * Enqueue an export job for background processing
   */
  @Post('export')
  @HttpCode(HttpStatus.ACCEPTED)
  async export(
    @Body() payload: ExportJobPayload,
  ): Promise<ExportJobResult> {
    return this.svc.enqueueExport(payload);
  }

  /**
   * GET /admin/reconciliation/report/export/:id
   * Get status of an export job
   */
  @Get('export/:id')
  async getExportStatus(
    @Param('id') jobId: string,
  ): Promise<{
    id: string;
    status: string;
    resultUrl?: string;
    error?: string;
    progress?: number;
  }> {
    return this.svc.getExportJobStatus(jobId);
  }

  /**
   * GET /admin/reconciliation/report/exports
   * List recent export jobs
   */
  @Get('exports')
  async listExports(
    @Query('page') page = '1',
    @Query('size') size = '20',
    @Query('status') status?: string,
  ): Promise<{
    items: Array<{
      id: string;
      status: string;
      createdAt: Date;
      completedAt?: Date;
      resultUrl?: string;
    }>;
    total: number;
  }> {
    return this.svc.listExportJobs({
      page: Number(page),
      size: Number(size),
      status,
    });
  }
}
