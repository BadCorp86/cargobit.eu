/**
 * Audit Log Verification Job
 * CargoBit Payment System
 * 
 * Scheduled job to verify audit log hash chain integrity,
 * detect tampering, and report anomalies.
 */

import { prisma } from '@/lib/prisma';
import { verifyHashChain, getAuditStats } from '@/services/auditLog';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  /** Number of entries to verify per run */
  batchSize: 10000,
  
  /** Alert threshold for errors */
  errorThreshold: 5,
  
  /** Enable detailed logging */
  verbose: process.env.VERBOSE === 'true',
};

// =============================================================================
// JOB RESULT
// =============================================================================

interface VerificationResult {
  success: boolean;
  timestamp: string;
  duration: number;
  checkedCount: number;
  errorsFound: number;
  errors: string[];
  warnings: string[];
}

// =============================================================================
// VERIFICATION FUNCTIONS
// =============================================================================

/**
 * Verify entire audit log chain
 */
async function verifyFullChain(): Promise<VerificationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('Starting full audit log verification...');
  
  try {
    // Get total count
    const totalCount = await prisma.auditLog.count();
    console.log(`Total audit entries: ${totalCount}`);
    
    // Verify hash chain
    const result = await verifyHashChain({ limit: CONFIG.batchSize });
    
    if (!result.valid) {
      errors.push(...result.errors);
    }
    
    // Check for gaps in sequence
    if (result.checkedCount < totalCount) {
      warnings.push(
        `Only verified ${result.checkedCount} of ${totalCount} entries ` +
        `(batch limit: ${CONFIG.batchSize})`
      );
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`Verification complete: ${result.checkedCount} entries checked`);
    console.log(`Errors found: ${errors.length}`);
    console.log(`Duration: ${duration}ms`);
    
    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      duration,
      checkedCount: result.checkedCount,
      errorsFound: errors.length,
      errors: errors.slice(0, 100), // Limit error output
      warnings,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Verification failed:', errorMessage);
    
    return {
      success: false,
      timestamp: new Date().toISOString(),
      duration,
      checkedCount: 0,
      errorsFound: 1,
      errors: [errorMessage],
      warnings,
    };
  }
}

/**
 * Verify recent entries only (last 24 hours)
 */
async function verifyRecentEntries(): Promise<VerificationResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const recentDate = new Date();
  recentDate.setHours(recentDate.getHours() - 24);
  
  console.log(`Verifying entries since ${recentDate.toISOString()}`);
  
  try {
    const entries = await prisma.auditLog.findMany({
      where: { timestamp: { gte: recentDate } },
      orderBy: { timestamp: 'asc' }
    });
    
    console.log(`Found ${entries.length} recent entries`);
    
    // Verify chain for recent entries
    let prevHash: string | null = null;
    
    for (const entry of entries) {
      if (entry.prevHash !== prevHash) {
        // Check if this is the first entry or a broken chain
        if (prevHash !== null) {
          errors.push(`Broken chain at ${entry.id}`);
        }
      }
      prevHash = entry.hash;
    }
    
    const duration = Date.now() - startTime;
    
    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      duration,
      checkedCount: entries.length,
      errorsFound: errors.length,
      errors,
      warnings,
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return {
      success: false,
      timestamp: new Date().toISOString(),
      duration,
      checkedCount: 0,
      errorsFound: 1,
      errors: [errorMessage],
      warnings,
    };
  }
}

/**
 * Check for anomalies in audit log patterns
 */
async function checkAnomalies(): Promise<string[]> {
  const anomalies: string[] = [];
  
  console.log('Checking for anomalies...');
  
  // Check for unusually high activity
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  
  const recentCount = await prisma.auditLog.count({
    where: { timestamp: { gte: oneHourAgo } }
  });
  
  // Threshold: more than 1000 entries per hour is unusual
  if (recentCount > 1000) {
    anomalies.push(`High activity detected: ${recentCount} entries in last hour`);
  }
  
  // Check for suspicious patterns
  const suspiciousActions = await prisma.auditLog.groupBy({
    by: ['action'],
    where: { timestamp: { gte: oneHourAgo } },
    _count: true,
    orderBy: { _count: { action: 'desc' } },
    take: 10
  });
  
  // Look for unusual failure patterns
  const failures = suspiciousActions.filter(
    a => a.action.includes('FAILED') || a.action.includes('ERROR')
  );
  
  for (const failure of failures) {
    if (failure._count > 50) {
      anomalies.push(
        `High failure rate: ${failure.action} occurred ${failure._count} times`
      );
    }
  }
  
  // Check for multiple actors from same IP (if tracked in metadata)
  // This would require extending the schema
  
  return anomalies;
}

// =============================================================================
// MAIN JOB
// =============================================================================

/**
 * Run audit verification job
 */
export async function runAuditVerification(
  options: { full?: boolean } = {}
): Promise<VerificationResult & { anomalies: string[] }> {
  console.log('========================================');
  console.log('CargoBit Audit Verification Job');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('========================================');
  
  // Run verification
  const result = options.full 
    ? await verifyFullChain()
    : await verifyRecentEntries();
  
  // Check for anomalies
  const anomalies = await checkAnomalies();
  
  // Log results
  console.log('\n========================================');
  console.log('VERIFICATION RESULT');
  console.log('========================================');
  console.log(`Success: ${result.success ? 'YES' : 'NO'}`);
  console.log(`Entries checked: ${result.checkedCount}`);
  console.log(`Errors found: ${result.errorsFound}`);
  console.log(`Duration: ${result.duration}ms`);
  
  if (anomalies.length > 0) {
    console.log('\nAnomalies detected:');
    anomalies.forEach(a => console.log(`  - ${a}`));
  }
  
  // Create audit entry for this verification
  await prisma.auditLog.create({
    data: {
      timestamp: new Date(),
      actor: 'system',
      action: 'AUDIT_VERIFICATION',
      entity: 'AuditLog',
      entityId: 'verification',
      metadata: {
        success: result.success,
        checkedCount: result.checkedCount,
        errorsFound: result.errorsFound,
        duration: result.duration,
        anomalies,
      } as any,
      prevHash: null, // Will be set by service
      hash: '', // Will be set by service
    }
  });
  
  // Alert if critical errors
  if (result.errorsFound >= CONFIG.errorThreshold) {
    console.error('\n⚠️  CRITICAL: Multiple integrity errors detected!');
    console.error('Immediate investigation required.');
    // TODO: Send alert via PagerDuty, Slack, etc.
  }
  
  return { ...result, anomalies };
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  
  const result = await runAuditVerification({ full });
  
  console.log('\n' + JSON.stringify(result, null, 2));
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default runAuditVerification;
