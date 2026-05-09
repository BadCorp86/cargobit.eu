/**
 * CargoBit Partner OAuth Service
 * Initiative 2: Sales/Partnerships - Embedded Pilot Integration
 * 
 * Provides OAuth2 authentication and embedded export functionality
 * for partner integrations.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID, createHash, randomBytes } from 'crypto';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import jwt from 'jsonwebtoken';

// =============================================================================
// TYPES
// =============================================================================

export type PartnerIntegrationStatus = 'pending' | 'active' | 'suspended' | 'terminated';
export type PartnerFeature = 'embedded_export' | 'webhook_notifications' | 'sso_integration' | 'white_label_dashboard' | 'api_access';

export interface PartnerIntegration {
    id: string;
    partnerName: string;
    partnerType: string;
    oauthClientId: string;
    oauthEnabled: boolean;
    status: PartnerIntegrationStatus;
    isPilot: boolean;
    enabledFeatures: PartnerFeature[];
    webhookUrl?: string;
    webhookEvents: string[];
    pilotCustomerIds: string[];
}

export interface OAuthToken {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    expiresIn: number;
    scopes: string[];
}

export interface EmbeddedExportRequest {
    partnerIntegrationId: string;
    partnerCustomerId: string;
    format: 'csv' | 'json' | 'xlsx';
    filters: Record<string, unknown>;
    partnerMetadata?: Record<string, unknown>;
}

export interface PartnerWebhookPayload {
    jobId: string;
    status: 'done' | 'failed' | 'pending';
    resultUrl?: string;
    metadata: {
        partnerCustomerId: string;
        exportFormat: string;
        recordCount?: number;
        fileSize?: number;
    };
}

// =============================================================================
// PROMETHEUS METRICS
// =============================================================================

const partnerOauthTokensIssued = new Counter({
    name: 'partner_oauth_tokens_issued_total',
    help: 'Total OAuth tokens issued for partners',
    labelNames: ['partner_id', 'grant_type'],
});

const partnerOauthTokenRefreshes = new Counter({
    name: 'partner_oauth_token_refreshes_total',
    help: 'Total OAuth token refreshes',
    labelNames: ['partner_id'],
});

const partnerExportsTotal = new Counter({
    name: 'partner_exports_total',
    help: 'Total exports initiated by partners',
    labelNames: ['partner_id', 'format', 'session_type'],
});

const partnerWebhooksSent = new Counter({
    name: 'partner_webhooks_sent_total',
    help: 'Total webhooks sent to partners',
    labelNames: ['partner_id', 'event_type', 'status'],
});

const partnerApiCalls = new Counter({
    name: 'partner_api_calls_total',
    help: 'Total API calls from partners',
    labelNames: ['partner_id', 'endpoint', 'status'],
});

// =============================================================================
// SERVICE CLASS
// =============================================================================

export class PartnerOAuthService {
    private prisma: PrismaClient;
    private jwtSecret: string;
    private accessTokenTTL = 3600; // 1 hour
    private refreshTokenTTL = 86400 * 30; // 30 days

    constructor(prisma?: PrismaClient) {
        this.prisma = prisma || new PrismaClient();
        this.jwtSecret = process.env.PARTER_JWT_SECRET || process.env.JWT_SECRET || 'partner-secret-key';
    }

    // =========================================================================
    // OAUTH FLOW METHODS
    // =========================================================================

    /**
     * Create OAuth authorization URL for partner
     */
    async getAuthorizationUrl(
        partnerClientId: string,
        redirectUri: string,
        scopes: string[],
        state: string
    ): Promise<string> {
        const partner = await this.getPartnerByClientId(partnerClientId);
        
        if (!partner) {
            throw new Error('Invalid client_id');
        }

        if (!partner.oauthEnabled) {
            throw new Error('OAuth not enabled for this partner');
        }

        // Validate redirect URI
        const validRedirectUris = partner.oauthRedirectUris || [];
        if (!validRedirectUris.includes(redirectUri)) {
            throw new Error('Invalid redirect_uri');
        }

        // Validate scopes
        const partnerScopes = partner.oauthScopes || [];
        const invalidScopes = scopes.filter(s => !partnerScopes.includes(s));
        if (invalidScopes.length > 0) {
            throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
        }

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: partnerClientId,
            redirect_uri: redirectUri,
            scope: scopes.join(' '),
            state: state,
        });

        return `${process.env.BASE_URL}/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForToken(
        partnerClientId: string,
        code: string,
        redirectUri: string,
        partnerCustomerId?: string
    ): Promise<OAuthToken> {
        const partner = await this.getPartnerByClientId(partnerClientId);
        
        if (!partner) {
            throw new Error('Invalid client_id');
        }

        // Validate the authorization code (would be stored from previous step)
        // In production, you'd validate against a stored code

        return this.generateTokens(partner, partnerCustomerId, ['export:read', 'export:write']);
    }

    /**
     * Refresh access token
     */
    async refreshAccessToken(
        refreshToken: string
    ): Promise<OAuthToken> {
        // Verify refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid refresh token');
        }

        const tokenRecord = await this.prisma.$queryRaw<Array<{
            id: string;
            partner_integration_id: string;
            partner_customer_id: string;
            scopes: any;
        }>>`
            SELECT id, partner_integration_id, partner_customer_id, scopes
            FROM partner_oauth_tokens
            WHERE refresh_token_hash = ${this.hashToken(refreshToken)}
            AND NOT revoked
            AND refresh_expires_at > NOW()
        `;

        if (!tokenRecord.length) {
            throw new Error('Refresh token not found or expired');
        }

        const partner = await this.getPartnerById(tokenRecord[0].partner_integration_id);
        if (!partner) {
            throw new Error('Partner not found');
        }

        // Revoke old token
        await this.prisma.$executeRaw`
            UPDATE partner_oauth_tokens 
            SET revoked = true, revoked_at = NOW(), revoked_reason = 'token_refresh'
            WHERE id = ${tokenRecord[0].id}
        `;

        // Generate new tokens
        const newTokens = await this.generateTokens(
            partner,
            tokenRecord[0].partner_customer_id,
            tokenRecord[0].scopes
        );

        partnerOauthTokenRefreshes.inc({ partner_id: partner.id });

        return newTokens;
    }

    /**
     * Validate access token
     */
    async validateAccessToken(accessToken: string): Promise<{
        valid: boolean;
        partner?: PartnerIntegration;
        partnerCustomerId?: string;
        scopes?: string[];
    }> {
        try {
            const decoded = jwt.verify(accessToken, this.jwtSecret) as any;

            const tokenRecord = await this.prisma.$queryRaw<Array<{
                id: string;
                partner_integration_id: string;
                partner_customer_id: string;
                scopes: any;
                expires_at: Date;
            }>>`
                SELECT id, partner_integration_id, partner_customer_id, scopes, expires_at
                FROM partner_oauth_tokens
                WHERE access_token_hash = ${this.hashToken(accessToken)}
                AND NOT revoked
                AND expires_at > NOW()
            `;

            if (!tokenRecord.length) {
                return { valid: false };
            }

            const partner = await this.getPartnerById(tokenRecord[0].partner_integration_id);

            // Update last used
            await this.prisma.$executeRaw`
                UPDATE partner_oauth_tokens 
                SET last_used_at = NOW()
                WHERE id = ${tokenRecord[0].id}
            `;

            return {
                valid: true,
                partner,
                partnerCustomerId: tokenRecord[0].partner_customer_id,
                scopes: tokenRecord[0].scopes,
            };
        } catch (error) {
            return { valid: false };
        }
    }

    // =========================================================================
    // EMBEDDED EXPORT METHODS
    // =========================================================================

    /**
     * Initiate embedded export for partner
     */
    async initiateEmbeddedExport(
        request: EmbeddedExportRequest,
        accessToken: string
    ): Promise<{
        sessionId: string;
        exportJobId: string;
        status: string;
    }> {
        // Validate access token
        const tokenInfo = await this.validateAccessToken(accessToken);
        if (!tokenInfo.valid || !tokenInfo.partner) {
            throw new Error('Invalid access token');
        }

        // Check feature is enabled
        if (!tokenInfo.partner.enabledFeatures.includes('embedded_export')) {
            throw new Error('Embedded export feature not enabled for this partner');
        }

        // Check pilot restrictions
        if (tokenInfo.partner.isPilot) {
            const pilotCustomers = tokenInfo.partner.pilotCustomerIds || [];
            if (pilotCustomers.length > 0 && !pilotCustomers.includes(request.partnerCustomerId)) {
                throw new Error('Customer not in pilot program');
            }
        }

        const sessionId = `pes_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        const exportJobId = `exp_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

        // Create export session
        await this.prisma.$executeRaw`
            INSERT INTO partner_export_sessions (
                id, partner_integration_id, partner_customer_id, export_job_id,
                session_type, initiated_by, export_format, export_filters, partner_metadata, status
            ) VALUES (
                ${sessionId}, ${request.partnerIntegrationId}, ${request.partnerCustomerId},
                ${exportJobId}, 'embedded', 'partner_api', ${request.format},
                ${JSON.stringify(request.filters)}::jsonb,
                ${JSON.stringify(request.partnerMetadata || {})}::jsonb,
                'pending'
            )
        `;

        // Queue export job (would integrate with reports service)
        // await reportsService.queueExport(exportJobId, request.format, request.filters);

        partnerExportsTotal.inc({
            partner_id: request.partnerIntegrationId,
            format: request.format,
            session_type: 'embedded',
        });

        return {
            sessionId,
            exportJobId,
            status: 'pending',
        };
    }

    /**
     * Get export session status
     */
    async getExportSessionStatus(sessionId: string): Promise<{
        status: string;
        resultUrl?: string;
        expiresAt?: Date;
        exportJobId: string;
    }> {
        const session = await this.prisma.$queryRaw<Array<{
            id: string;
            export_job_id: string;
            status: string;
            result_url: string | null;
            signed_url_expires_at: Date | null;
        }>>`
            SELECT id, export_job_id, status, result_url, signed_url_expires_at
            FROM partner_export_sessions
            WHERE id = ${sessionId}
        `;

        if (!session.length) {
            throw new Error('Session not found');
        }

        return {
            exportJobId: session[0].export_job_id,
            status: session[0].status,
            resultUrl: session[0].result_url ?? undefined,
            expiresAt: session[0].signed_url_expires_at ?? undefined,
        };
    }

    // =========================================================================
    // WEBHOOK METHODS
    // =========================================================================

    /**
     * Send webhook notification to partner
     */
    async sendWebhookNotification(
        partnerId: string,
        eventType: string,
        payload: PartnerWebhookPayload
    ): Promise<{ success: boolean; deliveryId: string }> {
        const partner = await this.getPartnerById(partnerId);
        
        if (!partner || !partner.webhookUrl) {
            return { success: false, deliveryId: '' };
        }

        // Check if event is subscribed
        if (!partner.webhookEvents.includes(eventType)) {
            return { success: false, deliveryId: '' };
        }

        const deliveryId = `pwd_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

        // Create delivery record
        await this.prisma.$executeRaw`
            INSERT INTO partner_webhook_deliveries (
                id, partner_integration_id, event_type, payload, status
            ) VALUES (
                ${deliveryId}, ${partnerId}, ${eventType},
                ${JSON.stringify(payload)}::jsonb, 'pending'
            )
        `;

        // Queue for delivery (would be processed by webhook worker)
        // await webhookWorker.queue(deliveryId);

        partnerWebhooksSent.inc({
            partner_id: partnerId,
            event_type: eventType,
            status: 'queued',
        });

        return { success: true, deliveryId };
    }

    /**
     * Notify partner of report export completion
     */
    async notifyReportExported(
        partnerId: string,
        partnerCustomerId: string,
        jobId: string,
        resultUrl: string,
        metadata: { format: string; recordCount?: number; fileSize?: number }
    ): Promise<void> {
        const payload: PartnerWebhookPayload = {
            jobId,
            status: 'done',
            resultUrl,
            metadata: {
                partnerCustomerId,
                exportFormat: metadata.format,
                recordCount: metadata.recordCount,
                fileSize: metadata.fileSize,
            },
        };

        await this.sendWebhookNotification(partnerId, 'report_exported', payload);

        // Update export session
        await this.prisma.$executeRaw`
            UPDATE partner_export_sessions 
            SET 
                status = 'completed',
                result_url = ${resultUrl},
                signed_url_expires_at = NOW() + INTERVAL '24 hours',
                completed_at = NOW()
            WHERE export_job_id = ${jobId}
        `;
    }

    // =========================================================================
    // UTILITY METHODS
    // =========================================================================

    /**
     * Generate OAuth tokens for partner
     */
    private async generateTokens(
        partner: any,
        partnerCustomerId: string | undefined,
        scopes: string[]
    ): Promise<OAuthToken> {
        const accessToken = this.generateAccessToken(partner.id, partnerCustomerId, scopes);
        const refreshToken = this.generateRefreshToken(partner.id, partnerCustomerId);

        // Store token hash
        await this.prisma.$executeRaw`
            INSERT INTO partner_oauth_tokens (
                id, partner_integration_id, partner_customer_id,
                access_token_hash, refresh_token_hash,
                expires_at, refresh_expires_at, scopes
            ) VALUES (
                ${`pot_${randomUUID().replace(/-/g, '').slice(0, 16)}`},
                ${partner.id},
                ${partnerCustomerId || null},
                ${this.hashToken(accessToken)},
                ${this.hashToken(refreshToken)},
                NOW() + INTERVAL '${this.accessTokenTTL} seconds',
                NOW() + INTERVAL '${this.refreshTokenTTL} seconds',
                ${JSON.stringify(scopes)}::jsonb
            )
        `;

        partnerOauthTokensIssued.inc({
            partner_id: partner.id,
            grant_type: 'authorization_code',
        });

        return {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: this.accessTokenTTL,
            scopes,
        };
    }

    private generateAccessToken(
        partnerId: string,
        partnerCustomerId: string | undefined,
        scopes: string[]
    ): string {
        return jwt.sign(
            {
                sub: partnerId,
                cid: partnerCustomerId,
                scopes,
                type: 'partner_access',
            },
            this.jwtSecret,
            { expiresIn: this.accessTokenTTL }
        );
    }

    private generateRefreshToken(
        partnerId: string,
        partnerCustomerId: string | undefined
    ): string {
        return jwt.sign(
            {
                sub: partnerId,
                cid: partnerCustomerId,
                type: 'partner_refresh',
                jti: randomUUID(),
            },
            this.jwtSecret,
            { expiresIn: this.refreshTokenTTL }
        );
    }

    private hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    private async getPartnerByClientId(clientId: string): Promise<any | null> {
        const result = await this.prisma.$queryRaw<Array<any>>`
            SELECT * FROM partner_integrations WHERE oauth_client_id = ${clientId}
        `;
        return result[0] || null;
    }

    private async getPartnerById(id: string): Promise<any | null> {
        const result = await this.prisma.$queryRaw<Array<any>>`
            SELECT * FROM partner_integrations WHERE id = ${id}
        `;
        return result[0] || null;
    }
}

// Export singleton
export const partnerOAuthService = new PartnerOAuthService();
