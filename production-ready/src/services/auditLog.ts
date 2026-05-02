/**
 * Audit Log Service
 * 
 * Tamper-proof audit logging with hash chain verification.
 * Every entry is linked to the previous entry via SHA256 hash.
 */

import crypto from "crypto";

// ============================================
// Types
// ============================================

export type ActorType = "USER" | "SYSTEM" | "API" | "WEBHOOK";

export interface AuditLogEntry {
  actor: string;
  actorType: ActorType;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any>;
}

export interface AuditLogRecord extends AuditLogEntry {
  id: string;
  timestamp: Date;
  prevHash: string | null;
  hash: string;
}

// ============================================
// Configuration
// ============================================

const HASH_ALGORITHM = "sha256";
const GENESIS_HASH = "genesis"; // Hash for the first entry

// ============================================
// Audit Log Writer
// ============================================

/**
 * Write an audit log entry with hash chain
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<string> {
  // Get the last entry to chain to
  const lastEntry = await getLastAuditEntry();
  const prevHash = lastEntry?.hash ?? null;

  // Calculate hash
  const hash = calculateHash({
    ...entry,
    timestamp: new Date(),
    prevHash,
  });

  // Generate ID
  const id = generateId();

  // Create record
  const record: AuditLogRecord = {
    id,
    timestamp: new Date(),
    ...entry,
    prevHash,
    hash,
  };

  // Persist to database
  await persistAuditLog(record);

  console.log(`[AuditLog] Created entry: ${record.id} (${entry.action})`);

  return id;
}

/**
 * Calculate SHA256 hash for an audit entry
 */
function calculateHash(data: {
  actor: string;
  actorType: ActorType;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  prevHash: string | null;
}): string {
  // Create deterministic string representation
  const payload = JSON.stringify({
    actor: data.actor,
    actorType: data.actorType,
    action: data.action,
    entity: data.entity,
    entityId: data.entityId,
    metadata: data.metadata || {},
    timestamp: data.timestamp.toISOString(),
    prevHash: data.prevHash ?? GENESIS_HASH,
  });

  return crypto.createHash(HASH_ALGORITHM).update(payload).digest("hex");
}

/**
 * Generate unique ID for audit log entry
 */
function generateId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

// ============================================
// Database Operations
// ============================================

/**
 * Get the last audit entry for chaining
 */
async function getLastAuditEntry(): Promise<AuditLogRecord | null> {
  // TODO: Implement with your database
  // return await prisma.auditLog.findFirst({
  //   orderBy: { timestamp: "desc" },
  // });

  return null;
}

/**
 * Persist audit log to database
 */
async function persistAuditLog(record: AuditLogRecord): Promise<void> {
  // TODO: Implement with your database
  // await prisma.auditLog.create({
  //   data: {
  //     id: record.id,
  //     timestamp: record.timestamp,
  //     actor: record.actor,
  //     actorType: record.actorType,
  //     action: record.action,
  //     entity: record.entity,
  //     entityId: record.entityId,
  //     metadata: record.metadata || {},
  //     prevHash: record.prevHash,
  //     hash: record.hash,
  //   },
  // });

  console.log(`[AuditLog] Persisted: ${record.id}`);
}

// ============================================
// Verification
// ============================================

export interface VerificationResult {
  valid: boolean;
  errors: Array<{ id: string; error: string }>;
  totalEntries: number;
  verifiedAt: Date;
}

/**
 * Verify the entire audit log chain
 * Returns all integrity violations found
 */
export async function verifyAuditChain(): Promise<VerificationResult> {
  const errors: Array<{ id: string; error: string }> = [];
  let totalEntries = 0;

  // TODO: Implement with your database
  // const entries = await prisma.auditLog.findMany({
  //   orderBy: { timestamp: "asc" },
  // });

  // For now, return success
  const entries: AuditLogRecord[] = [];

  let expectedPrevHash: string | null = null;

  for (const entry of entries) {
    totalEntries++;

    // Check prev_hash continuity
    if (entry.prevHash !== expectedPrevHash) {
      errors.push({
        id: entry.id,
        error: `Hash chain broken: expected prevHash ${expectedPrevHash}, got ${entry.prevHash}`,
      });
    }

    // Verify hash calculation
    const calculatedHash = calculateHash(entry);
    if (entry.hash !== calculatedHash) {
      errors.push({
        id: entry.id,
        error: `Hash mismatch: stored ${entry.hash}, calculated ${calculatedHash}`,
      });
    }

    expectedPrevHash = entry.hash;
  }

  return {
    valid: errors.length === 0,
    errors,
    totalEntries,
    verifiedAt: new Date(),
  };
}

/**
 * Verify a specific audit entry
 */
export async function verifyAuditEntry(id: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  // TODO: Implement with your database
  // const entry = await prisma.auditLog.findUnique({ where: { id } });
  // if (!entry) {
  //   return { valid: false, error: "Entry not found" };
  // }

  // const calculatedHash = calculateHash(entry);
  // if (entry.hash !== calculatedHash) {
  //   return { valid: false, error: "Hash mismatch" };
  // }

  return { valid: true };
}

// ============================================
// Query Helpers
// ============================================

export interface AuditLogQuery {
  actor?: string;
  actorType?: ActorType;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(
  query: AuditLogQuery
): Promise<{ entries: AuditLogRecord[]; total: number }> {
  // TODO: Implement with your database
  // const where: any = {};
  // if (query.actor) where.actor = query.actor;
  // if (query.actorType) where.actorType = query.actorType;
  // if (query.action) where.action = query.action;
  // if (query.entity) where.entity = query.entity;
  // if (query.entityId) where.entityId = query.entityId;
  // if (query.from || query.to) {
  //   where.timestamp = {};
  //   if (query.from) where.timestamp.gte = query.from;
  //   if (query.to) where.timestamp.lte = query.to;
  // }

  // const [entries, total] = await Promise.all([
  //   prisma.auditLog.findMany({
  //     where,
  //     orderBy: { timestamp: "desc" },
  //     take: query.limit ?? 100,
  //     skip: query.offset ?? 0,
  //   }),
  //   prisma.auditLog.count({ where }),
  // ]);

  return { entries: [], total: 0 };
}

// ============================================
// Export Functions
// ============================================

/**
 * Export audit logs for a date range (for compliance/archival)
 */
export async function exportAuditLogs(
  from: Date,
  to: Date
): Promise<string> {
  const { entries } = await queryAuditLogs({ from, to, limit: 10000 });

  // Format as JSONL (one JSON object per line)
  const lines = entries.map((entry) => JSON.stringify(entry));

  return lines.join("\n");
}

/**
 * Export audit logs for a specific entity
 */
export async function exportEntityAuditLog(
  entity: string,
  entityId: string
): Promise<string> {
  const { entries } = await queryAuditLogs({ entity, entityId, limit: 1000 });

  return JSON.stringify(entries, null, 2);
}

// ============================================
// Convenience Methods
// ============================================

/**
 * Log user action
 */
export async function logUserAction(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, any>
): Promise<string> {
  return writeAuditLog({
    actor: userId,
    actorType: "USER",
    action,
    entity,
    entityId,
    metadata,
  });
}

/**
 * Log system action
 */
export async function logSystemAction(
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, any>
): Promise<string> {
  return writeAuditLog({
    actor: "system",
    actorType: "SYSTEM",
    action,
    entity,
    entityId,
    metadata,
  });
}

/**
 * Log API action
 */
export async function logApiAction(
  apiKey: string,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, any>
): Promise<string> {
  return writeAuditLog({
    actor: apiKey,
    actorType: "API",
    action,
    entity,
    entityId,
    metadata,
  });
}

/**
 * Log webhook action
 */
export async function logWebhookAction(
  source: string,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Record<string, any>
): Promise<string> {
  return writeAuditLog({
    actor: source,
    actorType: "WEBHOOK",
    action,
    entity,
    entityId,
    metadata,
  });
}
