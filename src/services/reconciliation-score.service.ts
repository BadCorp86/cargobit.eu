/**
 * CargoBit Reconciliation Score Service
 * Initiative 1: Data Product MVP - Reconciliation Score
 * 
 * Provides reconciliation scoring for payouts with configurable rules,
 * score breakdown, and Prometheus metrics.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// =============================================================================
// TYPES
// =============================================================================

export type ScoreLevel = 'excellent' | 'good' | 'warning' | 'critical';
export type ScoreFactorType = 
  | 'amount_mismatch'
  | 'missing_payment'
  | 'duplicate_payout'
  | 'status_inconsistency'
  | 'timing_deviation'
  | 'currency_mismatch'
  | 'reference_mismatch'
  | 'fee_discrepancy'
  | 'partial_payment'
  | 'manual_override';

export interface ScoreFactor {
  type: ScoreFactorType;
  severity: number;
  details?: Record<string, unknown>;
}

export interface ReconciliationScore {
  id: string;
  payoutId: string;
  reconciliationRunId?: string;
  score: number;
  scoreLevel: ScoreLevel;
  completenessScore: number;
  accuracyScore: number;
  timelinessScore: number;
  consistencyScore: number;
  scoreFactors: ScoreFactor[];
  calculationVersion: string;
  calculatedAt: Date;
  manuallyOverridden: boolean;
  overrideReason?: string;
  overriddenBy?: string;
}

export interface ScoreCalculationInput {
  payoutId: string;
  expectedAmountCents?: bigint;
  actualAmountCents?: bigint;
  expectedStatus?: string;
  actualStatus?: string;
  reference?: string;
  reconciliationRunId?: string;
}

export interface ScoreFilter {
  minScore?: number;
  maxScore?: number;
  scoreLevel?: ScoreLevel;
  payoutId?: string;
  reconciliationRunId?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface ScoreStatistics {
  totalScores: number;
  averageScore: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    warning: number;
    critical: number;
  };
  scorePercentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  topFactors: Array<{
    type: ScoreFactorType;
    count: number;
    avgSeverity: number;
  }>;
}

// =============================================================================
// PROMETHEUS METRICS
// =============================================================================

const reconciliationScoresTotal = new Counter({
  name: 'reconciliation_scores_total',
  help: 'Total number of reconciliation scores calculated',
  labelNames: ['score_level', 'calculation_version'],
});

const reconciliationScoreValue = new Histogram({
  name: 'reconciliation_score_value',
  help: 'Distribution of reconciliation score values',
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

const reconciliationScoreCalculationDuration = new Histogram({
  name: 'reconciliation_score_calculation_duration_seconds',
  help: 'Time taken to calculate reconciliation scores',
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

const reconciliationScoresByLevel = new Gauge({
  name: 'reconciliation_scores_by_level',
  help: 'Current count of reconciliation scores by level',
  labelNames: ['score_level'],
});

const reconciliationScoreFactorTotal = new Counter({
  name: 'reconciliation_score_factor_total',
  help: 'Total occurrences of each score factor type',
  labelNames: ['factor_type'],
});

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class ReconciliationScoreService {
  private prisma: PrismaClient;
  private calculationVersion = '1.0.0';

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Calculate and store reconciliation score for a payout
   */
  async calculateScore(input: ScoreCalculationInput): Promise<ReconciliationScore> {
    const startTime = Date.now();
    
    try {
      // Get payout data if not fully provided
      const payout = await this.getPayoutData(input.payoutId);
      
      const expectedAmount = input.expectedAmountCents ?? payout?.amountCents ?? BigInt(0);
      const actualAmount = input.actualAmountCents ?? payout?.amountCents ?? BigInt(0);
      const expectedStatus = input.expectedStatus ?? 'paid';
      const actualStatus = input.actualStatus ?? payout?.status ?? 'unknown';
      const reference = input.reference ?? payout?.reference;

      // Calculate score factors
      const factors: ScoreFactor[] = [];
      let score = 100;

      // Rule 1: Status Inconsistency
      if (actualStatus !== expectedStatus) {
        factors.push({
          type: 'status_inconsistency',
          severity: 30,
          details: { expected: expectedStatus, actual: actualStatus },
        });
        score -= 30;
      }

      // Rule 2: Amount Mismatch
      if (expectedAmount !== actualAmount) {
        const difference = Math.abs(Number(expectedAmount - actualAmount));
        factors.push({
          type: 'amount_mismatch',
          severity: 40,
          details: {
            expectedCents: Number(expectedAmount),
            actualCents: Number(actualAmount),
            differenceCents: difference,
          },
        });
        score -= 40;
      }

      // Rule 3: Duplicate Check
      if (reference) {
        const duplicates = await this.checkDuplicates(input.payoutId, reference);
        if (duplicates > 0) {
          factors.push({
            type: 'duplicate_payout',
            severity: 60,
            details: { reference, duplicateCount: duplicates },
          });
          score -= 60;
        }
      }

      // Rule 4: Check for missing expected payout
      const expectedPayout = await this.getExpectedPayout(reference);
      if (!expectedPayout && reference) {
        factors.push({
          type: 'missing_payment',
          severity: 80,
          details: { reference },
        });
        score -= 80;
      }

      // Ensure score is within bounds
      score = Math.max(0, Math.min(100, score));

      // Determine score level
      const scoreLevel = this.determineScoreLevel(score);

      // Calculate breakdown scores
      const breakdown = this.calculateBreakdownScores(factors);

      // Create score record
      const scoreRecord: ReconciliationScore = {
        id: `rs_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
        payoutId: input.payoutId,
        reconciliationRunId: input.reconciliationRunId,
        score,
        scoreLevel,
        manuallyOverridden: false,
        ...breakdown,
        scoreFactors: factors,
        calculationVersion: this.calculationVersion,
        calculatedAt: new Date(),
      };

      // Store in database
      await this.storeScore(scoreRecord);

      // Record metrics
      this.recordMetrics(score, scoreLevel, factors, Date.now() - startTime);

      return scoreRecord;
    } finally {
      reconciliationScoreCalculationDuration.observe((Date.now() - startTime) / 1000);
    }
  }

  /**
   * Get reconciliation score by payout ID
   */
  async getScoreByPayoutId(payoutId: string): Promise<ReconciliationScore | null> {
    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      payout_id: string;
      reconciliation_run_id: string | null;
      score: number;
      score_level: string;
      completeness_score: number;
      accuracy_score: number;
      timeliness_score: number;
      consistency_score: number;
      score_factors: any;
      calculation_version: string;
      calculated_at: Date;
      manually_overridden: boolean;
      override_reason: string | null;
      overridden_by: string | null;
    }>>`
      SELECT * FROM reconciliation_scores 
      WHERE payout_id = ${payoutId} 
      ORDER BY calculated_at DESC 
      LIMIT 1
    `;

    if (!result.length) return null;

    return this.mapToScore(result[0]);
  }

  /**
   * Get scores with filtering
   */
  async getScores(filter: ScoreFilter, page = 1, limit = 50): Promise<{
    scores: ReconciliationScore[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;
    
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.minScore !== undefined) {
      conditions.push(`score >= $${paramIndex++}`);
      params.push(filter.minScore);
    }
    if (filter.maxScore !== undefined) {
      conditions.push(`score <= $${paramIndex++}`);
      params.push(filter.maxScore);
    }
    if (filter.scoreLevel) {
      conditions.push(`score_level = $${paramIndex++}`);
      params.push(filter.scoreLevel);
    }
    if (filter.payoutId) {
      conditions.push(`payout_id = $${paramIndex++}`);
      params.push(filter.payoutId);
    }
    if (filter.reconciliationRunId) {
      conditions.push(`reconciliation_run_id = $${paramIndex++}`);
      params.push(filter.reconciliationRunId);
    }
    if (filter.fromDate) {
      conditions.push(`calculated_at >= $${paramIndex++}`);
      params.push(filter.fromDate);
    }
    if (filter.toDate) {
      conditions.push(`calculated_at <= $${paramIndex++}`);
      params.push(filter.toDate);
    }

    const whereClause = conditions.join(' AND ');

    const results = await this.prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM reconciliation_scores WHERE ${whereClause} ORDER BY calculated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      ...params, limit, offset
    );

    const countResult = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM reconciliation_scores WHERE ${whereClause}`,
      ...params
    );

    return {
      scores: results.map(this.mapToScore),
      total: Number(countResult[0]?.count ?? 0),
      page,
      limit,
    };
  }

  /**
   * Get score statistics
   */
  async getStatistics(filter?: ScoreFilter): Promise<ScoreStatistics> {
    const whereClause = filter ? this.buildWhereClause(filter) : '1=1';

    const stats = await this.prisma.$queryRawUnsafe<Array<{
      total: bigint;
      avg_score: number;
      excellent_count: bigint;
      good_count: bigint;
      warning_count: bigint;
      critical_count: bigint;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    }>>(`
      WITH stats AS (
        SELECT 
          COUNT(*) as total,
          AVG(score) as avg_score,
          COUNT(*) FILTER (WHERE score_level = 'excellent') as excellent_count,
          COUNT(*) FILTER (WHERE score_level = 'good') as good_count,
          COUNT(*) FILTER (WHERE score_level = 'warning') as warning_count,
          COUNT(*) FILTER (WHERE score_level = 'critical') as critical_count,
          PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score) as p50,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score) as p75,
          PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY score) as p90,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY score) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY score) as p99
        FROM reconciliation_scores
        WHERE ${whereClause}
      )
      SELECT * FROM stats
    `);

    // Get top factors
    const factorStats = await this.prisma.$queryRawUnsafe<Array<{
      factor_type: string;
      count: bigint;
      avg_severity: number;
    }>>(`
      SELECT 
        factor->>'type' as factor_type,
        COUNT(*) as count,
        AVG((factor->>'severity')::int) as avg_severity
      FROM reconciliation_scores, jsonb_array_elements(score_factors) as factor
      WHERE ${whereClause}
      GROUP BY factor->>'type'
      ORDER BY count DESC
      LIMIT 10
    `);

    const result = stats[0];

    // Update gauge metrics
    reconciliationScoresByLevel.set({ score_level: 'excellent' }, Number(result?.excellent_count ?? 0));
    reconciliationScoresByLevel.set({ score_level: 'good' }, Number(result?.good_count ?? 0));
    reconciliationScoresByLevel.set({ score_level: 'warning' }, Number(result?.warning_count ?? 0));
    reconciliationScoresByLevel.set({ score_level: 'critical' }, Number(result?.critical_count ?? 0));

    return {
      totalScores: Number(result?.total ?? 0),
      averageScore: Math.round((result?.avg_score ?? 0) * 100) / 100,
      scoreDistribution: {
        excellent: Number(result?.excellent_count ?? 0),
        good: Number(result?.good_count ?? 0),
        warning: Number(result?.warning_count ?? 0),
        critical: Number(result?.critical_count ?? 0),
      },
      scorePercentiles: {
        p50: Math.round((result?.p50 ?? 0) * 100) / 100,
        p75: Math.round((result?.p75 ?? 0) * 100) / 100,
        p90: Math.round((result?.p90 ?? 0) * 100) / 100,
        p95: Math.round((result?.p95 ?? 0) * 100) / 100,
        p99: Math.round((result?.p99 ?? 0) * 100) / 100,
      },
      topFactors: factorStats.map(f => ({
        type: f.factor_type as ScoreFactorType,
        count: Number(f.count),
        avgSeverity: Math.round(f.avg_severity * 100) / 100,
      })),
    };
  }

  /**
   * Manually override a score
   */
  async overrideScore(
    payoutId: string,
    newScore: number,
    reason: string,
    overriddenBy: string
  ): Promise<ReconciliationScore> {
    const existing = await this.getScoreByPayoutId(payoutId);
    if (!existing) {
      throw new Error(`Score not found for payout ${payoutId}`);
    }

    const scoreLevel = this.determineScoreLevel(newScore);

    await this.prisma.$executeRaw`
      UPDATE reconciliation_scores 
      SET 
        score = ${newScore},
        score_level = ${scoreLevel}::score_level,
        manually_overridden = true,
        override_reason = ${reason},
        overridden_by = ${overriddenBy},
        overridden_at = NOW(),
        updated_at = NOW()
      WHERE payout_id = ${payoutId}
    `;

    return {
      ...existing,
      score: newScore,
      scoreLevel,
      manuallyOverridden: true,
      overrideReason: reason,
      overriddenBy,
    };
  }

  /**
   * Batch calculate scores for reconciliation run
   */
  async batchCalculateScores(reconciliationRunId: string): Promise<{
    processed: number;
    scores: ReconciliationScore[];
    errors: Array<{ payoutId: string; error: string }>;
  }> {
    // Get all payouts from the reconciliation run
    const payouts = await this.prisma.$queryRaw<Array<{
      id: string;
      amount_cents: bigint;
      status: string;
      reference: string | null;
    }>>`
      SELECT p.id, p.amount_cents, p.status, p.reference
      FROM payouts p
      JOIN reconciliation_results rr ON rr.payout_id = p.id
      WHERE rr.reconciliation_run_id = ${reconciliationRunId}
    `;

    const scores: ReconciliationScore[] = [];
    const errors: Array<{ payoutId: string; error: string }> = [];

    for (const payout of payouts) {
      try {
        const score = await this.calculateScore({
          payoutId: payout.id,
          actualAmountCents: payout.amount_cents,
          actualStatus: payout.status,
          reference: payout.reference ?? undefined,
          reconciliationRunId,
        });
        scores.push(score);
      } catch (error) {
        errors.push({
          payoutId: payout.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      processed: payouts.length,
      scores,
      errors,
    };
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private async getPayoutData(payoutId: string): Promise<{
    amountCents: bigint;
    status: string;
    reference: string | null;
  } | null> {
    const result = await this.prisma.$queryRaw<Array<{
      amount_cents: bigint;
      status: string;
      reference: string | null;
    }>>`
      SELECT amount_cents, status, reference 
      FROM payouts 
      WHERE id = ${payoutId}
    `;

    return result[0] ?? null;
  }

  private async checkDuplicates(payoutId: string, reference: string): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count 
      FROM payouts 
      WHERE reference = ${reference} AND id != ${payoutId}
    `;

    return Number(result[0]?.count ?? 0);
  }

  private async getExpectedPayout(reference: string | null): Promise<{
    expectedAmountCents: bigint;
  } | null> {
    if (!reference) return null;

    const result = await this.prisma.$queryRaw<Array<{
      expected_amount_cents: bigint;
    }>>`
      SELECT expected_amount_cents 
      FROM expected_payouts 
      WHERE reference = ${reference}
    `;

    return result[0] ? { expectedAmountCents: result[0].expected_amount_cents } : null;
  }

  private determineScoreLevel(score: number): ScoreLevel {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  }

  private calculateBreakdownScores(factors: ScoreFactor[]): {
    completenessScore: number;
    accuracyScore: number;
    timelinessScore: number;
    consistencyScore: number;
  } {
    const breakdown = {
      completenessScore: 100,
      accuracyScore: 100,
      timelinessScore: 100,
      consistencyScore: 100,
    };

    for (const factor of factors) {
      switch (factor.type) {
        case 'missing_payment':
          breakdown.completenessScore -= factor.severity;
          break;
        case 'amount_mismatch':
        case 'fee_discrepancy':
        case 'partial_payment':
          breakdown.accuracyScore -= factor.severity;
          break;
        case 'timing_deviation':
          breakdown.timelinessScore -= factor.severity;
          break;
        case 'status_inconsistency':
        case 'duplicate_payout':
          breakdown.consistencyScore -= factor.severity;
          break;
      }
    }

    // Clamp to 0-100
    return {
      completenessScore: Math.max(0, Math.min(100, breakdown.completenessScore)),
      accuracyScore: Math.max(0, Math.min(100, breakdown.accuracyScore)),
      timelinessScore: Math.max(0, Math.min(100, breakdown.timelinessScore)),
      consistencyScore: Math.max(0, Math.min(100, breakdown.consistencyScore)),
    };
  }

  private async storeScore(score: ReconciliationScore): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO reconciliation_scores (
        id, payout_id, reconciliation_run_id, score, score_level,
        completeness_score, accuracy_score, timeliness_score, consistency_score,
        score_factors, calculation_version, calculated_at, manually_overridden
      ) VALUES (
        ${score.id}, ${score.payoutId}, ${score.reconciliationRunId ?? null},
        ${score.score}, ${score.scoreLevel}::score_level,
        ${score.completenessScore}, ${score.accuracyScore}, 
        ${score.timelinessScore}, ${score.consistencyScore},
        ${JSON.stringify(score.scoreFactors)}::jsonb, ${score.calculationVersion},
        ${score.calculatedAt}, ${score.manuallyOverridden}
      )
      ON CONFLICT (payout_id, reconciliation_run_id) 
      DO UPDATE SET
        score = EXCLUDED.score,
        score_level = EXCLUDED.score_level,
        score_factors = EXCLUDED.score_factors,
        calculated_at = EXCLUDED.calculated_at,
        updated_at = NOW()
    `;
  }

  private recordMetrics(
    score: number,
    scoreLevel: ScoreLevel,
    factors: ScoreFactor[],
    durationMs: number
  ): void {
    reconciliationScoresTotal.inc({ score_level: scoreLevel, calculation_version: this.calculationVersion });
    reconciliationScoreValue.observe(score);

    for (const factor of factors) {
      reconciliationScoreFactorTotal.inc({ factor_type: factor.type });
    }
  }

  private buildWhereClause(filter: ScoreFilter): string {
    const conditions: string[] = [];

    if (filter.minScore !== undefined) conditions.push(`score >= ${filter.minScore}`);
    if (filter.maxScore !== undefined) conditions.push(`score <= ${filter.maxScore}`);
    if (filter.scoreLevel) conditions.push(`score_level = '${filter.scoreLevel}'`);
    if (filter.payoutId) conditions.push(`payout_id = '${filter.payoutId}'`);
    if (filter.reconciliationRunId) conditions.push(`reconciliation_run_id = '${filter.reconciliationRunId}'`);
    if (filter.fromDate) conditions.push(`calculated_at >= '${filter.fromDate.toISOString()}'`);
    if (filter.toDate) conditions.push(`calculated_at <= '${filter.toDate.toISOString()}'`);

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  private mapToScore(row: any): ReconciliationScore {
    return {
      id: row.id,
      payoutId: row.payout_id,
      reconciliationRunId: row.reconciliation_run_id ?? undefined,
      score: row.score,
      scoreLevel: row.score_level as ScoreLevel,
      completenessScore: row.completeness_score,
      accuracyScore: row.accuracy_score,
      timelinessScore: row.timeliness_score,
      consistencyScore: row.consistency_score,
      scoreFactors: Array.isArray(row.score_factors) ? row.score_factors : JSON.parse(row.score_factors || '[]'),
      calculationVersion: row.calculation_version,
      calculatedAt: row.calculated_at,
      manuallyOverridden: row.manually_overridden,
      overrideReason: row.override_reason ?? undefined,
      overriddenBy: row.overridden_by ?? undefined,
    };
  }
}

// Export singleton instance
export const reconciliationScoreService = new ReconciliationScoreService();
