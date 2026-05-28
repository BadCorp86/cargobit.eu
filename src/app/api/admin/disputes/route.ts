/**
 * CargoBit Admin Disputes API
 * 
 * GET /api/admin/disputes - List all disputes with filters
 * 
 * RBAC: ADMIN, SUPPORT roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { buildEvidenceWorkflowSummary } from '@/lib/disputes/evidence-workflow';

// ============================================
// GET: LIST DISPUTES
// ============================================

export async function GET(request: NextRequest) {
  return withAdminAuth(request, async (admin) => {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const reason = searchParams.get('reason');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build filter
    const where: any = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }
    
    if (reason) {
      where.reason = reason.toUpperCase();
    }
    
    // Query disputes
    const disputes = await prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    
    // Get creators
    const creatorIds = [...new Set(disputes.map(d => d.createdById))];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const creatorMap = new Map(creators.map(c => [c.id, c]));

    // Get counterparties
    const againstIds = [...new Set(disputes.map(d => d.againstId).filter(Boolean))] as string[];
    const counterparties = againstIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: againstIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const counterpartyMap = new Map(counterparties.map(c => [c.id, c]));
    
    // Get assigned admins
    const assignedIds = [...new Set(disputes.filter(d => d.assignedToId).map(d => d.assignedToId!))];
    const assignedAdmins = assignedIds.length > 0 
      ? await prisma.adminUser.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, email: true },
        })
      : [];
    const adminMap = new Map(assignedAdmins.map(a => [a.id, a]));

    const disputeIds = disputes.map(d => d.id);
    const latestEvidenceEvents = disputeIds.length > 0
      ? await prisma.disputeAuditEvent.findMany({
          where: {
            disputeId: { in: disputeIds },
            eventType: {
              in: [
                'evidence_requested',
                'evidence_deadline_extended',
                'evidence_reviewed',
                'auto_resolution_blocked',
                'auto_resolution_approved',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const evidenceEventMap = new Map<string, typeof latestEvidenceEvents>();
    latestEvidenceEvents.forEach((event) => {
      evidenceEventMap.set(event.disputeId, [...(evidenceEventMap.get(event.disputeId) || []), event]);
    });

    const jobIds = [...new Set(disputes.map(d => d.jobId))];
    const supportTickets = jobIds.length > 0
      ? await prisma.supportTicket.findMany({
          where: {
            category: 'DISPUTE_EVIDENCE',
            transportId: { in: jobIds },
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            transportId: true,
            subject: true,
            priority: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : [];
    const ticketMap = new Map<string, (typeof supportTickets)[number]>();
    supportTickets.forEach((ticket) => {
      if (!ticket.transportId) return;
      const key = `${ticket.transportId}:${ticket.userId}`;
      if (!ticketMap.has(key)) {
        ticketMap.set(key, ticket);
      }
    });
    
    // Get total count
    const total = await prisma.dispute.count({ where });
    
    // Format response
    const items = disputes.map(d => {
      const creator = creatorMap.get(d.createdById);
      const against = d.againstId ? counterpartyMap.get(d.againstId) : null;
      const assignedTo = d.assignedToId ? adminMap.get(d.assignedToId) : null;
      const description = d.description || '';
      const supportTicket = ticketMap.get(`${d.jobId}:${d.createdById}`);
      const evidenceRequest = buildEvidenceWorkflowSummary(evidenceEventMap.get(d.id) || []);
      
      return {
        id: d.id,
        jobId: d.jobId,
        createdById: d.createdById,
        createdBy: creator 
          ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email
          : 'Unknown',
        createdByEmail: creator?.email || null,
        against: against 
          ? { id: against.id, name: `${against.firstName || ''} ${against.lastName || ''}`.trim() || against.email, email: against.email }
          : null,
        reason: d.reason,
        subject: d.subject,
        description: description.substring(0, 100) + (description.length > 100 ? '...' : ''),
        disputedAmountCents: d.disputedAmountCents,
        disputedAmountEur: d.disputedAmountCents ? d.disputedAmountCents / 100 : null,
        status: d.status,
        assignedTo: assignedTo ? { id: assignedTo.id, email: assignedTo.email } : null,
        supportTicket: supportTicket ? {
          id: supportTicket.id,
          subject: supportTicket.subject,
          priority: supportTicket.priority,
          status: supportTicket.status,
          createdAt: supportTicket.createdAt,
          updatedAt: supportTicket.updatedAt,
        } : null,
        evidenceRequest,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        resolvedAt: d.resolvedAt,
      };
    });
    
    return NextResponse.json({
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
