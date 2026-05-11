import { PrismaClient } from '@prisma/client';
import { ReconciliationService } from '../services/reconciliation.service';

/**
 * Simple reconciliation scheduler without NestJS dependencies
 * Uses database-based leader locking for distributed systems
 */
export class ReconciliationScheduler {
  private prisma: PrismaClient;
  private isRunning = false;

  constructor(private readonly reconciliationService: ReconciliationService) {
    this.prisma = new PrismaClient();
  }

  /**
   * Manual trigger for reconciliation
   */
  async triggerManually(): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      console.log('Manual reconciliation triggered');
      const result = await this.reconciliationService.runReconciliation();
      return { success: true, result };
    } catch (error: any) {
      console.error('Manual reconciliation failed:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Acquire leader lock
   */
  private async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      const result = await this.prisma.leaderLock.upsert({
        where: { key },
        create: {
          key,
          holderId: process.env.HOSTNAME || 'local',
          expiresAt,
        },
        update: {
          holderId: process.env.HOSTNAME || 'local',
          expiresAt,
        },
      });

      return result.holderId === (process.env.HOSTNAME || 'local');
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      return false;
    }
  }

  /**
   * Release leader lock
   */
  private async releaseLock(key: string): Promise<void> {
    try {
      await this.prisma.leaderLock.deleteMany({
        where: {
          key,
          holderId: process.env.HOSTNAME || 'local',
        },
      });
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }

  /**
   * Record metrics for monitoring
   */
  private async recordMetrics(
    result: { processed: number; diffs: any[]; errors: string[] },
    durationMs: number
  ): Promise<void> {
    try {
      console.log({
        event: 'reconciliation_metrics',
        processed: result.processed,
        diffs: result.diffs.length,
        errors: result.errors.length,
        duration_ms: durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to record metrics:', error);
    }
  }
}
