import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../services/reports.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExportJob } from '../entities/export-job.entity';
import { ReportsMetricsService } from '../metrics/reports.metrics';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockJobsRepo: any;
  let mockMetrics: any;

  beforeEach(async () => {
    mockJobsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };

    mockMetrics = {
      incrementExportsQueued: jest.fn(),
      incrementExportsRunning: jest.fn(),
      incrementExportsCompleted: jest.fn(),
      incrementExportsFailed: jest.fn(),
      recordExportDuration: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(ExportJob),
          useValue: mockJobsRepo,
        },
        {
          provide: ReportsMetricsService,
          useValue: mockMetrics,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe('listReports', () => {
    it('should return paginated list with summary', async () => {
      const result = await service.listReports({ page: 1, size: 10 });

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('size', 10);
      expect(result).toHaveProperty('summary');
    });

    it('should apply filters correctly', async () => {
      const result = await service.listReports({
        page: 1,
        size: 50,
        filters: {
          status: 'paid',
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
        },
      });

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });
  });

  describe('enqueueExport', () => {
    it('should create a new export job', async () => {
      const mockJob = {
        id: 'test-uuid',
        payload: { format: 'csv' },
        status: 'queued',
      };

      mockJobsRepo.create.mockReturnValue(mockJob);
      mockJobsRepo.save.mockResolvedValue(mockJob);

      const result = await service.enqueueExport({ format: 'csv' });

      expect(result).toHaveProperty('jobId');
      expect(result.status).toBe('queued');
      expect(mockMetrics.incrementExportsQueued).toHaveBeenCalled();
    });

    it('should accept JSON format', async () => {
      const mockJob = {
        id: 'test-uuid-json',
        payload: { format: 'json' },
        status: 'queued',
      };

      mockJobsRepo.create.mockReturnValue(mockJob);
      mockJobsRepo.save.mockResolvedValue(mockJob);

      const result = await service.enqueueExport({ format: 'json' });

      expect(result.status).toBe('queued');
    });
  });

  describe('getExportJobStatus', () => {
    it('should return job status when found', async () => {
      const mockJob = {
        id: 'test-job-id',
        status: 'done',
        result_url: '/exports/test.csv',
        error: null,
      };

      mockJobsRepo.findOne.mockResolvedValue(mockJob);

      const result = await service.getExportJobStatus('test-job-id');

      expect(result.id).toBe('test-job-id');
      expect(result.status).toBe('done');
      expect(result.resultUrl).toBe('/exports/test.csv');
    });

    it('should throw NotFoundException when job not found', async () => {
      mockJobsRepo.findOne.mockResolvedValue(null);

      await expect(service.getExportJobStatus('non-existent')).rejects.toThrow(
        'not found',
      );
    });

    it('should calculate progress correctly', async () => {
      const testCases = [
        { status: 'queued', expectedProgress: 0 },
        { status: 'running', expectedProgress: 50 },
        { status: 'done', expectedProgress: 100 },
        { status: 'failed', expectedProgress: 0 },
      ];

      for (const { status, expectedProgress } of testCases) {
        mockJobsRepo.findOne.mockResolvedValue({
          id: 'test-id',
          status,
        });

        const result = await service.getExportJobStatus('test-id');
        expect(result.progress).toBe(expectedProgress);
      }
    });
  });

  describe('listExportJobs', () => {
    it('should return paginated list of jobs', async () => {
      const mockJobs = [
        { id: 'job-1', status: 'done', created_at: new Date() },
        { id: 'job-2', status: 'queued', created_at: new Date() },
      ];

      mockJobsRepo.findAndCount.mockResolvedValue([mockJobs, 2]);

      const result = await service.listExportJobs({ page: 1, size: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockJobsRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listExportJobs({ page: 1, size: 20, status: 'queued' });

      expect(mockJobsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'queued' },
        }),
      );
    });
  });

  describe('markJobRunning', () => {
    it('should update job status to running', async () => {
      await service.markJobRunning('test-job-id');

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        { id: 'test-job-id' },
        expect.objectContaining({
          status: 'running',
        }),
      );
      expect(mockMetrics.incrementExportsRunning).toHaveBeenCalled();
    });
  });

  describe('markJobDone', () => {
    it('should update job status with results', async () => {
      await service.markJobDone('test-job-id', '/exports/result.csv', 100, '5KB', 1500);

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        { id: 'test-job-id' },
        expect.objectContaining({
          status: 'done',
          result_url: '/exports/result.csv',
          rows_exported: 100,
          file_size: '5KB',
          duration_ms: 1500,
        }),
      );
      expect(mockMetrics.incrementExportsCompleted).toHaveBeenCalled();
      expect(mockMetrics.recordExportDuration).toHaveBeenCalledWith(1.5);
    });
  });

  describe('markJobFailed', () => {
    it('should update job status with error', async () => {
      await service.markJobFailed('test-job-id', 'Connection timeout');

      expect(mockJobsRepo.update).toHaveBeenCalledWith(
        { id: 'test-job-id' },
        expect.objectContaining({
          status: 'failed',
          error: 'Connection timeout',
        }),
      );
      expect(mockMetrics.incrementExportsFailed).toHaveBeenCalled();
    });
  });

  describe('getNextQueuedJob', () => {
    it('should return the oldest queued job', async () => {
      const mockJob = {
        id: 'oldest-job',
        status: 'queued',
        created_at: new Date('2024-01-01'),
      };

      mockJobsRepo.findOne.mockResolvedValue(mockJob);

      const result = await service.getNextQueuedJob();

      expect(result).toEqual(mockJob);
      expect(mockJobsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'queued' },
          order: { created_at: 'ASC' },
        }),
      );
    });

    it('should return null when no queued jobs', async () => {
      mockJobsRepo.findOne.mockResolvedValue(null);

      const result = await service.getNextQueuedJob();

      expect(result).toBeNull();
    });
  });

  describe('getSummary', () => {
    it('should return aggregated statistics', async () => {
      const result = await service.getSummary({});

      expect(result).toHaveProperty('totalPayouts');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('avgProcessingTime');
    });
  });
});
