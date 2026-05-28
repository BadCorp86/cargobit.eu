/**
 * CargoBit Admin Dispute Detail API
 * 
 * GET /api/admin/disputes/{disputeId} - Get dispute details with messages
 * POST /api/admin/disputes/{disputeId} - Add message to dispute
 * 
 * RBAC: ADMIN, SUPPORT roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminAuth, AdminRole } from '@/lib/admin-rbac';
import { buildEvidenceWorkflowSummary, parseDisputeMetadata } from '@/lib/disputes/evidence-workflow';

// ============================================
// GET: DISPUTE DETAIL
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> | { disputeId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { disputeId } = await params;
    
    // Get dispute with relations
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
        auditEvents: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    
    if (!dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }
    
    // Get creator
    const creator = await prisma.user.findUnique({
      where: { id: dispute.createdById },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    
    // Get counterparty (if set)
    const against = dispute.againstId 
      ? await prisma.user.findUnique({
          where: { id: dispute.againstId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : null;
    
    // Get assigned admin
    const assignedTo = dispute.assignedToId
      ? await prisma.adminUser.findUnique({
          where: { id: dispute.assignedToId },
          select: { id: true, email: true },
        })
      : null;
    
    // Get resolved by admin
    const resolvedBy = dispute.resolvedById
      ? await prisma.adminUser.findUnique({
          where: { id: dispute.resolvedById },
          select: { id: true, email: true },
        })
      : null;

    const supportTickets = await prisma.supportTicket.findMany({
      where: {
        userId: dispute.createdById,
        transportId: dispute.jobId,
        category: 'DISPUTE_EVIDENCE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        description: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        closedAt: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            senderRole: true,
            message: true,
            isInternal: true,
            createdAt: true,
          },
        },
      },
    });
    
    // Get message senders
    const senderIds = [...new Set(dispute.messages.map(m => m.senderId))];
    const senders = await prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const senderMap = new Map(senders.map(s => [s.id, s]));
    const evidenceRequest = buildEvidenceWorkflowSummary(dispute.auditEvents);
    
    // Format result
    const result = {
      id: dispute.id,
      jobId: dispute.jobId,
      reason: dispute.reason,
      subject: dispute.subject,
      description: dispute.description,
      disputedAmountCents: dispute.disputedAmountCents,
      disputedAmountEur: dispute.disputedAmountCents ? dispute.disputedAmountCents / 100 : null,
      status: dispute.status,
      resolution: dispute.resolution,
      resolutionText: dispute.resolutionText,
      refundAmountCents: dispute.refundAmountCents,
      refundAmountEur: dispute.refundAmountCents ? dispute.refundAmountCents / 100 : null,
      
      // People
      createdBy: creator 
        ? { id: creator.id, name: `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.email, email: creator.email }
        : { id: dispute.createdById, name: 'Unknown', email: 'N/A' },
      against: against 
        ? { id: against.id, name: `${against.firstName || ''} ${against.lastName || ''}`.trim() || against.email, email: against.email }
        : null,
      assignedTo: assignedTo 
        ? { id: assignedTo.id, email: assignedTo.email }
        : null,
      resolvedBy: resolvedBy
        ? { id: resolvedBy.id, email: resolvedBy.email }
        : null,
      
      // Timestamps
      createdAt: dispute.createdAt,
      resolvedAt: dispute.resolvedAt,
      
      // Messages
      messages: dispute.messages.map(m => {
        const sender = senderMap.get(m.senderId);
        return {
          id: m.id,
          senderId: m.senderId,
          senderName: sender 
            ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email
            : 'Unknown',
          senderType: m.senderType,
          message: m.message,
          attachments: m.attachments ? JSON.parse(m.attachments) : [],
          isInternal: m.isInternal,
          createdAt: m.createdAt,
        };
      }),
      
      // Attachments
      attachments: dispute.attachments.map(a => ({
        id: a.id,
        fileName: a.fileName,
        fileUrl: a.fileUrl,
        fileType: a.fileType,
        fileSize: a.fileSize,
        uploadedBy: a.uploadedBy,
        createdAt: a.createdAt,
      })),

      evidenceRequest,
      supportTickets: supportTickets.map(ticket => ({
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        resolvedAt: ticket.resolvedAt,
        closedAt: ticket.closedAt,
        messages: ticket.messages.map(message => ({
          id: message.id,
          senderRole: message.senderRole,
          message: message.message,
          isInternal: message.isInternal,
          createdAt: message.createdAt,
        })),
      })),
      
      // Audit trail
      auditTrail: dispute.auditEvents.map(e => ({
        id: e.id,
        eventType: e.eventType,
        oldStatus: e.oldStatus,
        newStatus: e.newStatus,
        metadata: parseDisputeMetadata(e.metadata),
        createdAt: e.createdAt,
      })),
    };
    
    return NextResponse.json(result);
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}

// ============================================
// POST: ADD MESSAGE TO DISPUTE
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ disputeId: string }> | { disputeId: string } }
) {
  return withAdminAuth(request, async (admin) => {
    const { disputeId } = await params;
    
    // Parse body
    const body = await request.json();
    const { message, isInternal } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Check dispute exists
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    
    if (!dispute) {
      return NextResponse.json(
        { error: 'Dispute not found' },
        { status: 404 }
      );
    }
    
    // Create message
    const newMessage = await prisma.disputeMessage.create({
      data: {
        disputeId,
        senderId: admin.id,
        senderType: 'ADMIN',
        message,
        isInternal: isInternal || false,
      },
    });
    
    // Create audit event
    await prisma.disputeAuditEvent.create({
      data: {
        disputeId,
        eventType: 'message',
        adminId: admin.id,
        metadata: JSON.stringify({ messageId: newMessage.id }),
      },
    });
    
    return NextResponse.json({
      id: newMessage.id,
      senderId: newMessage.senderId,
      senderType: newMessage.senderType,
      message: newMessage.message,
      isInternal: newMessage.isInternal,
      createdAt: newMessage.createdAt,
    });
  }, [AdminRole.ADMIN, AdminRole.SUPPORT]);
}
