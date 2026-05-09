/**
 * CargoBit Secure Export Service
 * Initiative 3: Security Audit Checklist for Exports and Signed URLs
 * 
 * Provides secure signed URLs, PII masking, and audit logging
 * for export operations.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash, createHmac } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// =============================================================================
// TYPES
// =============================================================================

export interface SignedUrlOptions {
    expiresIn?: number;  // Default: 3600 (1 hour), Max: 86400 (24 hours)
    contentType?: string;
    metadata?: Record<string, string>;
    ipAddress?: string;
    userId?: string;
    purpose: 'export' | 'download' | 'upload';
}

export interface SignedUrlResult {
    url: string;
    expiresAt: Date;
    key: string;
    token: string;
}

export interface PiiField {
    field: string;
    type: 'email' | 'phone' | 'ssn' | 'iban' | 'name' | 'address' | 'custom';
    maskChar?: string;
    visibleChars?: number;
}

export interface AuditLogEntry {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string;
    partnerId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    result: 'success' | 'failure' | 'denied';
    errorMessage?: string;
}

// =============================================================================
// PROMETHEUS METRICS
// =============================================================================

const signedUrlsGenerated = new Counter({
    name: 'signed_urls_generated_total',
    help: 'Total signed URLs generated',
    labelNames: ['purpose', 'expires_in_bucket'],
});

const signedUrlsAccessed = new Counter({
    name: 'signed_urls_accessed_total',
    help: 'Total signed URLs accessed',
    labelNames: ['purpose', 'result'],
});

const piiFieldsMasked = new Counter({
    name: 'pii_fields_masked_total',
    help: 'Total PII fields masked in exports',
    labelNames: ['field_type'],
});

const exportAuditLogsCreated = new Counter({
    name: 'export_audit_logs_created_total',
    help: 'Total export audit log entries created',
    labelNames: ['action', 'result'],
});

const signedUrlExpiryWarnings = new Counter({
    name: 'signed_url_expiry_warnings_total',
    help: 'Signed URLs approaching expiry',
});

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class SecureExportService {
    private prisma: PrismaClient;
    private s3Client: S3Client;
    private bucketName: string;
    private signingSecret: string;
    private defaultExpiry = 3600; // 1 hour
    private maxExpiry = 86400; // 24 hours

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || new PrismaClient();
        this.bucketName = process.env.EXPORT_BUCKET || 'cargobit-exports';
        this.signingSecret = process.env.WEBHOOK_SIGNING_SECRET || 'export-signing-secret';
        
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'eu-central-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
    }

    // =========================================================================
    // SIGNED URL METHODS
    // =========================================================================

    /**
     * Generate a signed URL for S3 object with expiry
     */
    async generateSignedUrl(
        key: string,
        options: SignedUrlOptions
    ): Promise<SignedUrlResult> {
        const expiresIn = Math.min(options.expiresIn || this.defaultExpiry, this.maxExpiry);
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        
        // Generate verification token
        const token = this.generateVerificationToken(key, expiresAt, options);

        // Create S3 signed URL
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ResponseContentType: options.contentType,
            ResponseCacheControl: 'private, max-age=3600',
        });

        const url = await getSignedUrl(this.s3Client, command, {
            expiresIn,
        });

        // Store signed URL record for audit
        await this.storeSignedUrlRecord(key, token, expiresAt, options);

        // Record metrics
        const expiryBucket = this.getExpiryBucket(expiresIn);
        signedUrlsGenerated.inc({ purpose: options.purpose, expires_in_bucket: expiryBucket });

        return {
            url,
            expiresAt,
            key,
            token,
        };
    }

    /**
     * Validate a signed URL token
     */
    async validateSignedUrlToken(
        key: string,
        token: string,
        ipAddress?: string
    ): Promise<{ valid: boolean; reason?: string }> {
        const record = await this.getSignedUrlRecord(key, token);

        if (!record) {
            return { valid: false, reason: 'Token not found' };
        }

        if (new Date() > record.expiresAt) {
            signedUrlsAccessed.inc({ purpose: record.purpose, result: 'expired' });
            return { valid: false, reason: 'Token expired' };
        }

        if (record.revoked) {
            signedUrlsAccessed.inc({ purpose: record.purpose, result: 'revoked' });
            return { valid: false, reason: 'Token revoked' };
        }

        // Optional: Validate IP address
        if (record.ipAddress && ipAddress && record.ipAddress !== ipAddress) {
            await this.auditLog({
                action: 'url_access_denied',
                entityType: 'signed_url',
                entityId: key,
                ipAddress,
                metadata: { reason: 'ip_mismatch', expected_ip: record.ipAddress },
                result: 'denied',
            });
            return { valid: false, reason: 'IP address mismatch' };
        }

        // Update access count
        await this.updateSignedUrlAccess(key, token);

        signedUrlsAccessed.inc({ purpose: record.purpose, result: 'success' });

        return { valid: true };
    }

    /**
     * Revoke a signed URL
     */
    async revokeSignedUrl(key: string, reason: string): Promise<void> {
        await this.prisma.$executeRaw`
            UPDATE signed_url_records 
            SET revoked = true, revoked_at = NOW(), revoked_reason = ${reason}
            WHERE key = ${key}
        `;

        await this.auditLog({
            action: 'url_revoked',
            entityType: 'signed_url',
            entityId: key,
            metadata: { reason },
            result: 'success',
        });
    }

    // =========================================================================
    // PII MASKING METHODS
    // =========================================================================

    /**
     * Mask PII fields in data
     */
    maskPiiFields(
        data: Record<string, any>,
        piiFields: PiiField[]
    ): Record<string, any> {
        const maskedData = { ...data };

        for (const piiField of piiFields) {
            const value = maskedData[piiField.field];
            if (value === undefined || value === null) continue;

            const maskedValue = this.maskValue(value, piiField);
            maskedData[piiField.field] = maskedValue;

            piiFieldsMasked.inc({ field_type: piiField.type });
        }

        return maskedData;
    }

    /**
     * Mask a single value based on PII field configuration
     */
    private maskValue(value: any, piiField: PiiField): string {
        const strValue = String(value);
        const maskChar = piiField.maskChar || '*';
        const visibleChars = piiField.visibleChars ?? this.getDefaultVisibleChars(piiField.type);

        switch (piiField.type) {
            case 'email':
                return this.maskEmail(strValue, maskChar, visibleChars);
            case 'phone':
                return this.maskPhone(strValue, maskChar, visibleChars);
            case 'ssn':
                return this.maskSsn(strValue, maskChar);
            case 'iban':
                return this.maskIban(strValue, maskChar, visibleChars);
            case 'name':
                return this.maskName(strValue, maskChar);
            case 'address':
                return this.maskAddress(strValue, maskChar, visibleChars);
            default:
                return this.maskGeneric(strValue, maskChar, visibleChars);
        }
    }

    private maskEmail(email: string, maskChar: string, visibleChars: number): string {
        const [localPart, domain] = email.split('@');
        if (!domain) return this.maskGeneric(email, maskChar, visibleChars);

        const visibleLocal = localPart.slice(0, Math.min(2, visibleChars));
        const maskedLocal = visibleLocal + maskChar.repeat(Math.max(0, localPart.length - 2));
        return `${maskedLocal}@${domain}`;
    }

    private maskPhone(phone: string, maskChar: string, visibleChars: number): string {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 4) return maskChar.repeat(phone.length);

        const visible = digits.slice(-visibleChars);
        const masked = maskChar.repeat(digits.length - visibleChars);
        return masked + visible;
    }

    private maskSsn(ssn: string, maskChar: string): string {
        const digits = ssn.replace(/\D/g, '');
        if (digits.length < 4) return maskChar.repeat(ssn.length);

        return maskChar.repeat(digits.length - 4) + digits.slice(-4);
    }

    private maskIban(iban: string, maskChar: string, visibleChars: number): string {
        const cleaned = iban.replace(/\s/g, '');
        if (cleaned.length < 8) return maskChar.repeat(iban.length);

        const country = cleaned.slice(0, 2);
        const check = cleaned.slice(2, 4);
        const visible = cleaned.slice(-visibleChars);
        const masked = maskChar.repeat(cleaned.length - 4 - visibleChars);

        return `${country}${check}${masked}${visible}`;
    }

    private maskName(name: string, maskChar: string): string {
        const parts = name.split(' ');
        return parts.map(part => {
            if (part.length <= 2) return part[0] + maskChar;
            return part[0] + maskChar.repeat(part.length - 2) + part.slice(-1);
        }).join(' ');
    }

    private maskAddress(address: string, maskChar: string, visibleChars: number): string {
        if (address.length <= visibleChars) return address;
        return address.slice(0, visibleChars) + maskChar.repeat(address.length - visibleChars);
    }

    private maskGeneric(value: string, maskChar: string, visibleChars: number): string {
        if (value.length <= visibleChars) return value;
        return value.slice(0, visibleChars) + maskChar.repeat(value.length - visibleChars);
    }

    private getDefaultVisibleChars(type: PiiField['type']): number {
        switch (type) {
            case 'email': return 2;
            case 'phone': return 4;
            case 'ssn': return 4;
            case 'iban': return 4;
            case 'address': return 10;
            default: return 3;
        }
    }

    // =========================================================================
    // AUDIT LOGGING METHODS
    // =========================================================================

    /**
     * Create audit log entry
     */
    async auditLog(entry: AuditLogEntry): Promise<void> {
        const id = `audit_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

        await this.prisma.$executeRaw`
            INSERT INTO export_audit_logs (
                id, action, entity_type, entity_id,
                user_id, partner_id, ip_address, user_agent,
                metadata, result, error_message, created_at
            ) VALUES (
                ${id}, ${entry.action}, ${entry.entityType}, ${entry.entityId},
                ${entry.userId || null}, ${entry.partnerId || null},
                ${entry.ipAddress || null}, ${entry.userAgent || null},
                ${JSON.stringify(entry.metadata || {})}::jsonb,
                ${entry.result}, ${entry.errorMessage || null}, NOW()
            )
        `;

        exportAuditLogsCreated.inc({ action: entry.action, result: entry.result });
    }

    /**
     * Log export event
     */
    async logExportEvent(
        userId: string,
        jobId: string,
        filters: Record<string, unknown>,
        format: string,
        result: 'success' | 'failure',
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.auditLog({
            action: 'export_created',
            entityType: 'export_job',
            entityId: jobId,
            userId,
            metadata: {
                format,
                filters: this.sanitizeFilters(filters),
                ...metadata,
            },
            result,
        });
    }

    /**
     * Log signed URL access
     */
    async logSignedUrlAccess(
        key: string,
        userId: string | undefined,
        ipAddress: string,
        result: 'success' | 'denied' | 'expired',
        metadata?: Record<string, unknown>
    ): Promise<void> {
        await this.auditLog({
            action: 'signed_url_accessed',
            entityType: 'export_artifact',
            entityId: key,
            userId,
            ipAddress,
            metadata,
            result,
        });
    }

    // =========================================================================
    // SECURITY CHECKS
    // =========================================================================

    /**
     * Check if export contains PII
     */
    async checkPiiPresence(filters: Record<string, unknown>): Promise<{
        hasPii: boolean;
        piiFields: string[];
        recommendation: string;
    }> {
        const piiFieldNames = [
            'email', 'phone', 'ssn', 'iban', 'first_name', 'last_name',
            'address', 'city', 'postal_code', 'date_of_birth', 'company_name'
        ];

        const presentPiiFields: string[] = [];

        // Check if filters would include PII fields
        const fields = (filters as any).fields || [];
        for (const field of fields) {
            if (piiFieldNames.some(pii => field.toLowerCase().includes(pii))) {
                presentPiiFields.push(field);
            }
        }

        return {
            hasPii: presentPiiFields.length > 0,
            piiFields: presentPiiFields,
            recommendation: presentPiiFields.length > 0
                ? 'Consider masking PII fields or adding audit flag'
                : 'No PII fields detected',
        };
    }

    /**
     * Validate export request security
     */
    async validateExportRequest(
        userId: string,
        filters: Record<string, unknown>,
        ipAddress: string
    ): Promise<{ allowed: boolean; reason?: string }> {
        // Check rate limit (would integrate with rate limiter)
        // const rateLimitOk = await this.checkRateLimit(userId, ipAddress);
        // if (!rateLimitOk) return { allowed: false, reason: 'Rate limit exceeded' };

        // Check for suspicious patterns
        const suspiciousPatterns = [
            { pattern: /[\';"]/, reason: 'SQL injection pattern detected' },
            { pattern: /<script/i, reason: 'Script injection pattern detected' },
        ];

        const filtersStr = JSON.stringify(filters);
        for (const { pattern, reason } of suspiciousPatterns) {
            if (pattern.test(filtersStr)) {
                await this.auditLog({
                    action: 'export_blocked',
                    entityType: 'export_request',
                    entityId: 'blocked',
                    userId,
                    ipAddress,
                    metadata: { reason, filters },
                    result: 'denied',
                });
                return { allowed: false, reason };
            }
        }

        return { allowed: true };
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private generateVerificationToken(
        key: string,
        expiresAt: Date,
        options: SignedUrlOptions
    ): string {
        const payload = `${key}:${expiresAt.getTime()}:${options.purpose}:${options.userId || 'anonymous'}`;
        return createHmac('sha256', this.signingSecret)
            .update(payload)
            .digest('hex')
            .slice(0, 32);
    }

    private async storeSignedUrlRecord(
        key: string,
        token: string,
        expiresAt: Date,
        options: SignedUrlOptions
    ): Promise<void> {
        await this.prisma.$executeRaw`
            INSERT INTO signed_url_records (
                id, key, token, expires_at, purpose, user_id, ip_address, created_at
            ) VALUES (
                ${`sur_${randomUUID().replace(/-/g, '').slice(0, 16)}`},
                ${key}, ${token}, ${expiresAt}, ${options.purpose},
                ${options.userId || null}, ${options.ipAddress || null}, NOW()
            )
            ON CONFLICT (key) DO UPDATE SET
                token = EXCLUDED.token,
                expires_at = EXCLUDED.expires_at,
                revoked = false,
                access_count = 0,
                created_at = NOW()
        `;
    }

    private async getSignedUrlRecord(key: string, token: string): Promise<{
        expiresAt: Date;
        purpose: string;
        revoked: boolean;
        ipAddress: string | null;
    } | null> {
        const result = await this.prisma.$queryRaw<Array<{
            expires_at: Date;
            purpose: string;
            revoked: boolean;
            ip_address: string | null;
        }>>`
            SELECT expires_at, purpose, revoked, ip_address
            FROM signed_url_records
            WHERE key = ${key} AND token = ${token}
        `;

        if (!result.length) return null;

        return {
            expiresAt: result[0].expires_at,
            purpose: result[0].purpose,
            revoked: result[0].revoked,
            ipAddress: result[0].ip_address,
        };
    }

    private async updateSignedUrlAccess(key: string, token: string): Promise<void> {
        await this.prisma.$executeRaw`
            UPDATE signed_url_records
            SET access_count = access_count + 1, last_accessed_at = NOW()
            WHERE key = ${key} AND token = ${token}
        `;
    }

    private sanitizeFilters(filters: Record<string, unknown>): Record<string, unknown> {
        // Remove sensitive filter values from audit logs
        const sanitized = { ...filters };
        const sensitiveKeys = ['password', 'secret', 'token', 'api_key'];

        for (const key of Object.keys(sanitized)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            }
        }

        return sanitized;
    }

    private getExpiryBucket(seconds: number): string {
        if (seconds <= 900) return '15min';
        if (seconds <= 3600) return '1h';
        if (seconds <= 21600) return '6h';
        if (seconds <= 86400) return '24h';
        return '24h+';
    }
}

// =============================================================================
// DEFAULT PII FIELDS CONFIGURATION
// =============================================================================

export const DEFAULT_PII_FIELDS: PiiField[] = [
    { field: 'email', type: 'email', visibleChars: 2 },
    { field: 'phone', type: 'phone', visibleChars: 4 },
    { field: 'ssn', type: 'ssn' },
    { field: 'iban', type: 'iban', visibleChars: 4 },
    { field: 'first_name', type: 'name' },
    { field: 'last_name', type: 'name' },
    { field: 'address', type: 'address', visibleChars: 10 },
    { field: 'company_name', type: 'name' },
];

// Export singleton
export const secureExportService = new SecureExportService();
