/**
 * Audit Log Service
 * CargoBit Payment System
 * 
 * Tamper-resistant audit logging with hash-chain integrity.
 * Each entry links to the previous entry, creating a verifiable chain.
 */

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface AuditEntryInput {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogQuery {
  actor?: string;
  action?: string | string[];
  entity?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// =============================================================================
// HASH CHAIN
// =============================================================================

/**
 * Generate hash for audit entry
 */
function generateHash(
  timestamp: Date,
  actor: string,
  action: string,
  entity: string,
  entityId: string,
  metadata: Record<string, unknown> | null,
  prevHash: string | null
): string {
  const data = JSON.stringify({
    timestamp: timestamp.toISOString(),
    actor,
    action,
    entity,
    entityId,
    metadata,
    prevHash,
  });
  
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Get the latest audit entry
 */
async function getLatestEntry(): Promise<{ hash: string } | null> {
  const latest = await prisma.auditLog.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { hash: true }
  });
  
  return latest;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Create a new audit entry with hash chain
 */
export async function createAuditEntry(input: AuditEntryInput): Promise<string> {
  // Get previous hash
  const latest = await getLatestEntry();
  const prevHash = latest?.hash || null;
  
  const timestamp = new Date();
  const metadata = input.metadata || null;
  
  // Generate hash
  const hash = generateHash(
    timestamp,
    input.actor,
    input.action,
    input.entity,
    input.entityId,
    metadata,
    prevHash
  );
  
  // Create entry
  const entry = await prisma.auditLog.create({
    data: {
      timestamp,
      actor: input.actor,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: metadata as any,
      prevHash,
      hash,
    }
  });
  
  return entry.id;
}

/**
 * Create multiple audit entries in batch
 */
export async function createAuditBatch(
  entries: AuditEntryInput[]
): Promise<number> {
  let prevHash: string | null = null;
  const latest = await getLatestEntry();
  prevHash = latest?.hash || null;
  
  const data = [];
  
  for (const input of entries) {
    const timestamp = new Date();
    const metadata = input.metadata || null;
    
    const hash = generateHash(
      timestamp,
      input.actor,
      input.action,
      input.entity,
      input.entityId,
      metadata,
      prevHash
    );
    
    data.push({
      timestamp,
      actor: input.actor,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: metadata as any,
      prevHash,
      hash,
    });
    
    prevHash = hash;
  }
  
  const result = await prisma.auditLog.createMany({ data });
  return result.count;
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

/**
 * Query audit logs
 */
export async function queryAuditLogs(query: AuditLogQuery) {
  const where: any = {};
  
  if (query.actor) where.actor = query.actor;
  if (query.entity) where.entity = query.entity;
  if (query.entityId) where.entityId = query.entityId;
  
  if (query.action) {
    where.action = Array.isArray(query.action) 
      ? { in: query.action } 
      : query.action;
  }
  
  if (query.startDate || query.endDate) {
    where.timestamp = {};
    if (query.startDate) where.timestamp.gte = query.startDate;
    if (query.endDate) where.timestamp.lte = query.endDate;
  }
  
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    }),
    prisma.auditLog.count({ where })
  ]);
  
  return { logs, total };
}

/**
 * Get audit trail for an entity
 */
export async function getEntityAuditTrail(
  entity: string,
  entityId: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Get audit history for an actor
 */
export async function getActorAuditHistory(
  actor: string,
  options: { startDate?: Date; endDate?: Date; limit?: number } = {}
) {
  return prisma.auditLog.findMany({
    where: {
      actor,
      ...(options.startDate || options.endDate ? {
        timestamp: {
          ...(options.startDate && { gte: options.startDate }),
          ...(options.endDate && { lte: options.endDate })
        }
      } : {})
    },
    orderBy: { timestamp: 'desc' },
    take: options.limit || 100
  });
}

// =============================================================================
// VERIFICATION
// =============================================================================

/**
 * Verify hash chain integrity
 */
export async function verifyHashChain(
  options: { limit?: number; fromEntry?: string } = {}
): Promise<{ valid: boolean; errors: string[]; checkedCount: number }> {
  const errors: string[] = [];
  const limit = options.limit || 1000;
  
  let entries;
  
  if (options.fromEntry) {
    // Start from specific entry
    const startEntry = await prisma.auditLog.findUnique({
      where: { id: options.fromEntry }
    });
    
    if (!startEntry) {
      return { valid: false, errors: ['Start entry not found'], checkedCount: 0 };
    }
    
    entries = await prisma.auditLog.findMany({
      where: { timestamp: { gte: startEntry.timestamp } },
      orderBy: { timestamp: 'asc' },
      take: limit
    });
  } else {
    entries = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' },
      take: limit
    });
  }
  
  let prevHash: string | null = null;
  
  for (const entry of entries) {
    // Verify prevHash link
    if (entry.prevHash !== prevHash) {
      errors.push(
        `Broken chain at ${entry.id}: expected prevHash ${prevHash}, got ${entry.prevHash}`
      );
    }
    
    // Verify hash
    const expectedHash = generateHash(
      entry.timestamp,
      entry.actor,
      entry.action,
      entry.entity,
      entry.entityId,
      entry.metadata as any,
      entry.prevHash
    );
    
    if (entry.hash !== expectedHash) {
      errors.push(
        `Invalid hash at ${entry.id}: hash mismatch indicates tampering`
      );
    }
    
    prevHash = entry.hash;
  }
  
  return {
    valid: errors.length === 0,
    errors,
    checkedCount: entries.length
  };
}

/**
 * Verify single entry integrity
 */
export async function verifyEntry(entryId: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const entry = await prisma.auditLog.findUnique({
    where: { id: entryId }
  });
  
  if (!entry) {
    return { valid: false, errors: ['Entry not found'] };
  }
  
  const errors: string[] = [];
  
  // Verify hash
  const expectedHash = generateHash(
    entry.timestamp,
    entry.actor,
    entry.action,
    entry.entity,
    entry.entityId,
    entry.metadata as any,
    entry.prevHash
  );
  
  if (entry.hash !== expectedHash) {
    errors.push('Hash mismatch - entry may have been tampered with');
  }
  
  // Verify prevHash link (if not first entry)
  if (entry.prevHash) {
    const prevEntry = await prisma.auditLog.findFirst({
      where: { hash: entry.prevHash }
    });
    
    if (!prevEntry) {
      errors.push('Previous entry not found - chain may be broken');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get audit statistics
 */
export async function getAuditStats(
  startDate: Date,
  endDate: Date
): Promise<{
  total: number;
  byAction: Record<string, number>;
  byEntity: Record<string, number>;
  byActor: Record<string, number>;
}> {
  const logs = await prisma.auditLog.findMany({
    where: {
      timestamp: { gte: startDate, lte: endDate }
    },
    select: { action: true, entity: true, actor: true }
  });
  
  const byAction: Record<string, number> = {};
  const byEntity: Record<string, number> = {};
  const byActor: Record<string, number> = {};
  
  for (const log of logs) {
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    byEntity[log.entity] = (byEntity[log.entity] || 0) + 1;
    byActor[log.actor] = (byActor[log.actor] || 0) + 1;
  }
  
  return { total: logs.length, byAction, byEntity, byActor };
}

// =============================================================================
// EXPORT (GDPR)
// =============================================================================

/**
 * Export audit data for an actor (GDPR right to access)
 */
export async function exportActorAuditData(actor: string): Promise<{
  actor: string;
  exportDate: string;
  entries: any[];
}> {
  const logs = await prisma.auditLog.findMany({
    where: { actor },
    orderBy: { timestamp: 'asc' }
  });
  
  return {
    actor,
    exportDate: new Date().toISOString(),
    entries: logs.map(log => ({
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      metadata: log.metadata
    }))
  };
}
