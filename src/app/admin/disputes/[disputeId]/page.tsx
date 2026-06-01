/**
 * CargoBit Admin - Dispute Detail Page
 * 
 * Detailed view and resolution of a dispute.
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/admin-layout';
import { StatusBadge } from '@/components/admin/status-badge';
import { ConfirmModal } from '@/components/admin/modal';
import {
  createDisputeDecisionRecommendation,
  type DisputeDecisionRecommendation,
} from '@/lib/disputes/dispute-decision-engine';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  senderId: string;
  senderEmail: string;
  senderRole: 'shipper' | 'transporter' | 'admin';
  message: string;
  attachments?: string[];
  createdAt: string;
}

interface Attachment {
  id?: string;
  fileName?: string;
  fileType?: string;
  createdAt?: string;
}

interface EvidenceRequest {
  requestedAt?: string;
  dueAt?: string;
  isOverdue?: boolean;
  missingEvidence?: string[];
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  autoResolution?: {
    state: 'default' | 'blocked' | 'approved';
    changedAt?: string | null;
    note?: string | null;
  };
}

interface SupportTicketSummary {
  id: string;
  subject?: string;
  description?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: Array<{
    id: string;
    senderRole?: string;
    message: string;
    isInternal?: boolean;
    createdAt?: string;
  }>;
}

interface AuditTrailEvent {
  id: string;
  eventType: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  metadata?: any;
  createdAt: string;
}

interface DisputeDetail {
  id: string;
  jobId: string;
  shipper: {
    id: string;
    email: string;
    name?: string;
  };
  transporter: {
    id: string;
    email: string;
    name?: string;
  };
  reason: string;
  description?: string;
  status: 'open' | 'in_progress' | 'in_review' | 'awaiting_info' | 'resolved' | 'closed' | 'rejected' | 'refunded';
  resolution?: 'refund_full' | 'refund_partial' | 'reject' | 'other';
  resolutionNote?: string;
  refundAmountCents?: number;
  paymentAmountCents: number;
  currency: string;
  messages: Message[];
  attachments?: Attachment[];
  evidenceRequest?: EvidenceRequest | null;
  supportTickets?: SupportTicketSummary[];
  auditTrail?: AuditTrailEvent[];
  createdAt: string;
  updatedAt: string;
}

type ResolutionType = 'refund_full' | 'refund_partial' | 'reject' | 'other';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency,
  }).format(amountCents / 100);
}

function formatEuroAmount(amount?: number | null): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount || 0));
}

function formatDateTime(value?: string): string {
  if (!value) return '-';

  return new Date(value).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRoleLabel(role: string): string {
  switch (role) {
    case 'shipper': return 'Shipper';
    case 'transporter': return 'Transporter';
    case 'admin': return 'Admin';
    default: return role;
  }
}

function getAuditLabel(eventType: string): string {
  const labels: Record<string, string> = {
    evidence_requested: 'Nachweise angefordert',
    evidence_deadline_extended: 'Nachweisfrist verlängert',
    evidence_reviewed: 'Nachweise geprüft',
    support_ticket_closed: 'Support Ticket geschlossen',
    auto_resolution_blocked: 'Auto-Entscheidung gesperrt',
    auto_resolution_approved: 'Auto-Entscheidung freigegeben',
    insurance_handoff_created: 'Versicherungs-Lead vorbereitet',
    recommendation_generated: 'KI Empfehlung erstellt',
    resolved: 'Streitfall gelöst',
    message: 'Nachricht hinzugefügt',
  };

  return labels[eventType] || eventType.replace(/_/g, ' ');
}

function normalizeDisputeStatus(status?: string): DisputeDetail['status'] {
  const normalized = (status || 'open').toLowerCase();
  if (normalized === 'awaiting_info') return 'awaiting_info';
  if (normalized === 'in_review') return 'in_review';
  if (normalized === 'in-progress') return 'in_progress';
  if (normalized === 'refunded') return 'refunded';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'resolved') return 'resolved';
  if (normalized === 'closed') return 'closed';
  return 'open';
}

function normalizeResolution(resolution?: string | null): ResolutionType | undefined {
  const normalized = (resolution || '').toLowerCase();
  if (normalized === 'refund_full') return 'refund_full';
  if (normalized === 'refund_partial' || normalized === 'compensation') return 'refund_partial';
  if (normalized === 'reject' || normalized === 'rejected') return 'reject';
  if (normalized) return 'other';
  return undefined;
}

function normalizePerson(person: any, fallbackEmail: string) {
  return {
    id: person?.id || 'unknown',
    email: person?.email || fallbackEmail,
    name: person?.name || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || undefined,
  };
}

function normalizeMessage(message: any): Message {
  const senderRole = (message.senderRole || message.senderType || '').toLowerCase();

  return {
    id: message.id || crypto.randomUUID(),
    senderId: message.senderId || 'unknown',
    senderEmail: message.senderEmail || message.senderName || 'unknown',
    senderRole: senderRole === 'admin' ? 'admin' : senderRole === 'transporter' || senderRole === 'driver' ? 'transporter' : 'shipper',
    message: message.message || '',
    attachments: message.attachments || [],
    createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date(message.createdAt || Date.now()).toISOString(),
  };
}

function normalizeEvidenceRequest(request: any): EvidenceRequest | null {
  if (!request) return null;

  return {
    requestedAt: typeof request.requestedAt === 'string' ? request.requestedAt : new Date(request.requestedAt || Date.now()).toISOString(),
    dueAt: typeof request.dueAt === 'string' ? request.dueAt : new Date(request.dueAt || Date.now()).toISOString(),
    isOverdue: Boolean(request.isOverdue),
    missingEvidence: Array.isArray(request.missingEvidence) ? request.missingEvidence : [],
    reviewedAt: request.reviewedAt ? typeof request.reviewedAt === 'string' ? request.reviewedAt : new Date(request.reviewedAt).toISOString() : null,
    reviewedBy: request.reviewedBy || null,
    autoResolution: {
      state: request.autoResolution?.state || 'default',
      changedAt: request.autoResolution?.changedAt
        ? typeof request.autoResolution.changedAt === 'string'
          ? request.autoResolution.changedAt
          : new Date(request.autoResolution.changedAt).toISOString()
        : null,
      note: request.autoResolution?.note || null,
    },
  };
}

function normalizeSupportTickets(tickets: any): SupportTicketSummary[] {
  if (!Array.isArray(tickets)) return [];

  return tickets.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: typeof ticket.createdAt === 'string' ? ticket.createdAt : new Date(ticket.createdAt || Date.now()).toISOString(),
    updatedAt: typeof ticket.updatedAt === 'string' ? ticket.updatedAt : new Date(ticket.updatedAt || Date.now()).toISOString(),
    messages: Array.isArray(ticket.messages) ? ticket.messages.map((message: any) => ({
      id: message.id,
      senderRole: message.senderRole,
      message: message.message || '',
      isInternal: Boolean(message.isInternal),
      createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date(message.createdAt || Date.now()).toISOString(),
    })) : [],
  }));
}

function normalizeAuditTrail(events: any): AuditTrailEvent[] {
  if (!Array.isArray(events)) return [];

  return events.map((event) => ({
    id: event.id || crypto.randomUUID(),
    eventType: event.eventType || 'event',
    oldStatus: event.oldStatus,
    newStatus: event.newStatus,
    metadata: event.metadata,
    createdAt: typeof event.createdAt === 'string' ? event.createdAt : new Date(event.createdAt || Date.now()).toISOString(),
  }));
}

function normalizeDisputePayload(payload: any, disputeId: string): DisputeDetail {
  const paymentAmountCents =
    payload.paymentAmountCents ||
    payload.disputedAmountCents ||
    payload.refundAmountCents ||
    Math.round((payload.disputedAmountEur || payload.refundAmountEur || 250) * 100);

  return {
    id: payload.id || disputeId,
    jobId: payload.jobId || payload.transportId || payload.job_id || 'job_preview',
    shipper: normalizePerson(payload.shipper || payload.createdBy, 'shipper@example.com'),
    transporter: normalizePerson(payload.transporter || payload.against, 'transporter@example.com'),
    reason: payload.reason || payload.subject || 'Streitfall',
    description: payload.description || '',
    status: normalizeDisputeStatus(payload.status),
    resolution: normalizeResolution(payload.resolution),
    resolutionNote: payload.resolutionNote || payload.resolutionText || undefined,
    refundAmountCents: payload.refundAmountCents || null,
    paymentAmountCents,
    currency: payload.currency || 'EUR',
    messages: Array.isArray(payload.messages) ? payload.messages.map(normalizeMessage) : [],
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    evidenceRequest: normalizeEvidenceRequest(payload.evidenceRequest),
    supportTickets: normalizeSupportTickets(payload.supportTickets),
    auditTrail: normalizeAuditTrail(payload.auditTrail),
    createdAt: typeof payload.createdAt === 'string' ? payload.createdAt : new Date(payload.createdAt || Date.now()).toISOString(),
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date(payload.updatedAt || Date.now()).toISOString(),
  };
}

function buildLocalRecommendation(dispute: DisputeDetail): DisputeDecisionRecommendation {
  return createDisputeDecisionRecommendation({
    id: dispute.id,
    jobId: dispute.jobId,
    status: dispute.status,
    reason: dispute.reason,
    description: dispute.description,
    paymentAmountCents: dispute.paymentAmountCents,
    disputedAmountCents: dispute.paymentAmountCents,
    refundableAmountCents: dispute.paymentAmountCents,
    currency: dispute.currency,
    createdAt: dispute.createdAt,
    messages: dispute.messages.map((message) => ({
      message: message.message,
      senderType: message.senderRole,
      createdAt: message.createdAt,
    })),
    attachments: dispute.attachments?.map((attachment) => ({
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      createdAt: attachment.createdAt,
    })),
  });
}

function recommendationRiskClass(riskLevel: DisputeDecisionRecommendation['riskLevel']) {
  switch (riskLevel) {
    case 'critical':
      return 'border-red-500/40 bg-red-500/10 text-red-200';
    case 'high':
      return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
    case 'medium':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
    default:
      return 'border-green-500/40 bg-green-500/10 text-green-200';
  }
}

function recommendationActionToResolution(action: DisputeDecisionRecommendation['action']): ResolutionType {
  if (action === 'REFUND_FULL') return 'refund_full';
  if (action === 'REFUND_PARTIAL' || action === 'COMPENSATION') return 'refund_partial';
  if (action === 'REJECT') return 'reject';
  return 'other';
}

function getAutoResolutionLabel(state?: string) {
  if (state === 'blocked') return 'Gesperrt';
  if (state === 'approved') return 'Freigegeben';
  return 'Nur Empfehlung';
}

function getDisputeActionMessage(action: string) {
  const messages: Record<string, string> = {
    MARK_EVIDENCE_REVIEWED: 'Nachweise wurden als geprüft markiert.',
    EXTEND_EVIDENCE_DEADLINE: 'Nachweisfrist wurde verlängert.',
    CLOSE_SUPPORT_TICKET: 'Support Ticket wurde geschlossen.',
    BLOCK_AUTO_RESOLUTION: 'Automatische Entscheidung wurde gesperrt.',
    APPROVE_AUTO_RESOLUTION: 'Automatische Entscheidung wurde freigegeben.',
  };

  return messages[action] || 'Admin-Aktion wurde ausgeführt.';
}

// ============================================
// DISPUTE DETAIL PAGE
// ============================================

export default function DisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const disputeId = params.disputeId as string;

  const [dispute, setDispute] = useState<DisputeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<DisputeDecisionRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationSource, setRecommendationSource] = useState<'live' | 'fallback' | 'local' | null>(null);
  const [resolutionType, setResolutionType] = useState<ResolutionType>('reject');
  const [partialAmount, setPartialAmount] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [requestingEvidence, setRequestingEvidence] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [insuranceLoading, setInsuranceLoading] = useState(false);

  const loadRecommendation = useCallback(async (currentDispute: DisputeDetail) => {
    setRecommendationLoading(true);
    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}/recommendation`);
      if (!res.ok) throw new Error('Recommendation API unavailable');
      const data = await res.json();
      setRecommendation(data.recommendation);
      setRecommendationSource(data.source === 'fallback' ? 'fallback' : 'live');
    } catch (err) {
      console.error('Failed to fetch dispute recommendation:', err);
      setRecommendation(buildLocalRecommendation(currentDispute));
      setRecommendationSource('local');
    } finally {
      setRecommendationLoading(false);
    }
  }, [disputeId]);

  const refreshDisputeDetail = useCallback(async () => {
    const res = await fetch(`/api/admin/disputes/${disputeId}`);
    if (!res.ok) throw new Error('Dispute not found');
    const data = await res.json();
    const normalized = normalizeDisputePayload(data, disputeId);
    setDispute(normalized);
    await loadRecommendation(normalized);
    return normalized;
  }, [disputeId, loadRecommendation]);

  useEffect(() => {
    const fetchDispute = async () => {
      try {
        const res = await fetch(`/api/admin/disputes/${disputeId}`);
        if (!res.ok) throw new Error('Dispute not found');
        const data = await res.json();
        const normalized = normalizeDisputePayload(data, disputeId);
        setDispute(normalized);
        await loadRecommendation(normalized);
      } catch (err) {
        console.error('Failed to fetch dispute:', err);
        setError('Dispute konnte nicht geladen werden');
        // Mock data for demo
        const fallbackDispute: DisputeDetail = {
          id: disputeId,
          jobId: 'job_abc123',
          shipper: {
            id: 'user_123',
            email: 'shipper@example.com',
            name: 'Max Mustermann',
          },
          transporter: {
            id: 'user_456',
            email: 'transporter@example.com',
            name: 'Anna Schmidt',
          },
          reason: 'Waren beschädigt angekommen',
          description: 'Die Ware wurde in beschädigtem Zustand geliefert. Mehrere Kartons waren aufgerissen und der Inhalt beschädigt.',
          status: 'open',
          paymentAmountCents: 25000,
          currency: 'EUR',
          messages: [
            {
              id: 'msg_1',
              senderId: 'user_123',
              senderEmail: 'shipper@example.com',
              senderRole: 'shipper',
              message: 'Ich möchte eine Erstattung, da die Ware beschädigt ist.',
              createdAt: new Date().toISOString(),
            },
            {
              id: 'msg_2',
              senderId: 'user_456',
              senderEmail: 'transporter@example.com',
              senderRole: 'transporter',
              message: 'Die Ware wurde ordnungsgemäß geladen und transportiert. Die Beschädigung muss bereits vor dem Transport entstanden sein.',
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            },
          ],
          attachments: [
            {
              id: 'attachment_1',
              fileName: 'damage-photo.jpg',
              fileType: 'image/jpeg',
              createdAt: new Date().toISOString(),
            },
          ],
          evidenceRequest: null,
          supportTickets: [],
          auditTrail: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDispute(fallbackDispute);
        await loadRecommendation(fallbackDispute);
      } finally {
        setLoading(false);
      }
    };

    fetchDispute();
  }, [disputeId, loadRecommendation]);

  const runDisputeAction = async (
    action: 'MARK_EVIDENCE_REVIEWED' | 'EXTEND_EVIDENCE_DEADLINE' | 'CLOSE_SUPPORT_TICKET' | 'BLOCK_AUTO_RESOLUTION' | 'APPROVE_AUTO_RESOLUTION',
    options: { dueAt?: string; ticketId?: string } = {}
  ) => {
    setActionLoading(action);
    setWorkflowMessage(null);

    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          note: actionNote,
          ...options,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      await refreshDisputeDetail();
      setActionNote('');
      setWorkflowMessage(getDisputeActionMessage(action));
    } catch (err: any) {
      console.error('Failed to run dispute action:', err);
      setWorkflowMessage(err.message || 'Admin-Aktion konnte nicht ausgeführt werden.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!dispute) return;

    const actionMap: Record<ResolutionType, 'REFUND_FULL' | 'REFUND_PARTIAL' | 'REJECT' | 'COMPENSATION'> = {
      refund_full: 'REFUND_FULL',
      refund_partial: 'REFUND_PARTIAL',
      reject: 'REJECT',
      other: 'COMPENSATION',
    };
    const refundAmountCents = resolutionType === 'refund_partial'
      ? Math.round(parseFloat(partialAmount || '0') * 100)
      : resolutionType === 'refund_full'
        ? dispute.paymentAmountCents
        : null;
    const finalResolutionText =
      resolutionNote.trim() ||
      recommendation?.resolutionDraft ||
      'Admin-Entscheidung nach manueller Prüfung.';

    if (resolutionType === 'refund_partial' && (!refundAmountCents || refundAmountCents <= 0)) {
      alert('Bitte einen gueltigen Erstattungsbetrag eingeben.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionMap[resolutionType],
          resolutionText: finalResolutionText,
          refundAmountCents,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Resolution failed');
      }

      router.push('/admin/disputes');
    } catch (err: any) {
      console.error('Failed to resolve dispute:', err);
      alert(err.message || 'Fehler beim Auflösen des Disputes');
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const applyRecommendation = () => {
    if (!recommendation) return;

    const nextResolution = recommendationActionToResolution(recommendation.action);
    setResolutionType(nextResolution);

    if (nextResolution === 'refund_partial' && recommendation.suggestedRefundAmountCents) {
      setPartialAmount((recommendation.suggestedRefundAmountCents / 100).toFixed(2));
    }

    if (nextResolution === 'refund_full') {
      setPartialAmount('');
    }

    setResolutionNote(recommendation.resolutionDraft);
  };

  const requestEvidenceWorkflow = async () => {
    if (!recommendation) return;

    setRequestingEvidence(true);
    setWorkflowMessage(null);

    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}/evidence-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missingEvidence: recommendation.missingEvidence,
          createTicket: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evidence request failed');

      const ticketText = data.supportTicket?.id ? ` Ticket: ${data.supportTicket.id}.` : '';
      setWorkflowMessage(
        data.mode === 'live'
          ? `Nachweise wurden angefordert.${ticketText}`
          : `Preview: Nachweis-Workflow simuliert.${ticketText}`
      );

      const requestedAt = new Date().toISOString();
      const dueAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      setDispute((current) => {
        if (!current) return current;

        const nextTicket = data.supportTicket?.id
          ? {
              id: data.supportTicket.id,
              subject: `Nachweise für Streitfall ${current.id}`,
              priority: data.supportTicket.priority,
              status: data.supportTicket.status,
              createdAt: requestedAt,
              updatedAt: requestedAt,
              messages: [],
            }
          : null;
        const supportTickets = nextTicket && !current.supportTickets?.some((ticket) => ticket.id === nextTicket.id)
          ? [nextTicket, ...(current.supportTickets || [])]
          : current.supportTickets || [];

        return {
          ...current,
          status: normalizeDisputeStatus(data.status || 'AWAITING_INFO'),
          evidenceRequest: {
            requestedAt,
            dueAt,
            isOverdue: false,
            missingEvidence: data.requestedEvidence || recommendation.missingEvidence,
          },
          supportTickets,
          auditTrail: [
            {
              id: `local_evidence_${Date.now()}`,
              eventType: 'evidence_requested',
              oldStatus: current.status,
              newStatus: 'AWAITING_INFO',
              metadata: { missingEvidence: data.requestedEvidence || recommendation.missingEvidence },
              createdAt: requestedAt,
            },
            ...(current.auditTrail || []),
          ],
        };
      });
    } catch (err: any) {
      console.error('Failed to request dispute evidence:', err);
      setWorkflowMessage(err.message || 'Nachweis-Workflow konnte nicht gestartet werden.');
    } finally {
      setRequestingEvidence(false);
    }
  };

  const createInsuranceHandoff = async () => {
    setInsuranceLoading(true);
    setWorkflowMessage(null);

    try {
      const res = await fetch(`/api/admin/disputes/${disputeId}/insurance-handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: actionNote,
          consentAccepted: false,
          markRedirected: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Insurance handoff failed');

      await refreshDisputeDetail();
      setWorkflowMessage(
        data.alreadyExists
          ? 'Versicherungs-Lead existiert bereits und wurde erneut angezeigt.'
          : `Versicherungs-Lead wurde vorbereitet. Lead: ${data.referral?.leadId || data.lead?.id || 'neu'}.`
      );
    } catch (err: any) {
      console.error('Failed to create insurance handoff:', err);
      setWorkflowMessage(err.message || 'Versicherungs-Lead konnte nicht vorbereitet werden.');
    } finally {
      setInsuranceLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !dispute) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      </AdminLayout>
    );
  }

  if (!dispute) return null;

  const canResolve = ['open', 'in_progress', 'in_review', 'awaiting_info'].includes(dispute.status);
  const latestSupportTicket = dispute.supportTickets?.[0] || null;
  const isLatestSupportTicketClosed = ['closed', 'resolved'].includes((latestSupportTicket?.status || '').toLowerCase());
  const autoResolutionState = dispute.evidenceRequest?.autoResolution?.state || 'default';
  const insuranceHandoff = dispute.auditTrail?.find((event) => event.eventType === 'insurance_handoff_created') || null;
  const insuranceHandoffData = insuranceHandoff?.metadata || null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/admin/disputes')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Dispute Details
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                Job: {dispute.jobId}
              </p>
            </div>
          </div>
          <StatusBadge status={dispute.status} size="lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Message Thread */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Konversation
              </h3>

              {/* Messages */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {dispute.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderRole === 'admin' ? 'justify-center' : msg.senderRole === 'shipper' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`
                      max-w-md p-4 rounded-lg
                      ${msg.senderRole === 'admin' 
                        ? 'bg-blue-50 dark:bg-blue-900/30' 
                        : msg.senderRole === 'shipper' 
                          ? 'bg-gray-100 dark:bg-gray-700' 
                          : 'bg-green-50 dark:bg-green-900/30'
                      }
                    `}>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`
                          text-xs font-medium px-2 py-0.5 rounded
                          ${msg.senderRole === 'admin' 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200' 
                            : msg.senderRole === 'shipper' 
                              ? 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200' 
                              : 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                          }
                        `}>
                          {getRoleLabel(msg.senderRole)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(msg.createdAt).toLocaleString('de-DE')}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resolution Panel */}
          <div className="space-y-6">
            {/* Participants Info */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Beteiligte
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Shipper</p>
                  <p className="font-medium">{dispute.shipper.name || dispute.shipper.email}</p>
                  <p className="text-sm text-gray-500">{dispute.shipper.email}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Transporter</p>
                  <p className="font-medium">{dispute.transporter.name || dispute.transporter.email}</p>
                  <p className="text-sm text-gray-500">{dispute.transporter.email}</p>
                </div>
              </div>
            </div>

            {/* Dispute Details */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Details
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Grund</p>
                  <p className="font-medium">{dispute.reason}</p>
                </div>
                {dispute.description && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Beschreibung</p>
                    <p className="text-sm">{dispute.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Zahlungsbetrag</p>
                  <p className="font-medium">{formatCurrency(dispute.paymentAmountCents, dispute.currency)}</p>
                </div>
              </div>
            </div>

            {/* Insurance Handoff */}
            <div className="rounded-lg border border-cyan-500/20 bg-white p-6 shadow dark:bg-gray-800">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-300">
                    Versicherung
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                    Schaden-Partner
                  </h3>
                </div>
                <StatusBadge
                  status={insuranceHandoff ? 'redirected' : 'pending'}
                  size="sm"
                />
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300">
                CargoBit bereitet hier nur den technischen Partner-Lead vor. Abschluss,
                Police und Schadenbearbeitung bleiben beim lizenzierten Versicherer oder Makler.
              </p>

              {insuranceHandoffData && (
                <div className="mt-4 space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {insuranceHandoffData.provider || 'Versicherungspartner'}
                      </p>
                      <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        Lead: {insuranceHandoffData.leadId || '-'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(insuranceHandoff?.createdAt)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <span>Prämie: {formatEuroAmount(insuranceHandoffData.premiumEstimateEur)}</span>
                    <span>Deckung: {formatEuroAmount(insuranceHandoffData.coverageEstimateEur)}</span>
                    <span>Warenwert: {formatEuroAmount(insuranceHandoffData.cargoValueEur)}</span>
                    <span>Provision: {formatEuroAmount(insuranceHandoffData.commissionEstimateEur)}</span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={createInsuranceHandoff}
                  disabled={insuranceLoading}
                  className="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:opacity-50"
                >
                  {insuranceLoading ? 'Bereite vor...' : insuranceHandoff ? 'Lead erneut prüfen' : 'Versicherungs-Lead vorbereiten'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (insuranceHandoffData?.referralUrl) {
                      window.open(insuranceHandoffData.referralUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  disabled={!insuranceHandoffData?.referralUrl}
                  className="rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:opacity-50 dark:text-cyan-200 dark:hover:bg-cyan-950/30"
                >
                  Partner-Link öffnen
                </button>
              </div>
            </div>

            {/* Evidence Workflow */}
            <div className="rounded-lg border border-yellow-500/20 bg-white p-6 shadow dark:bg-gray-800">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Nachweise
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ticket, Frist und offene Unterlagen
                  </p>
                </div>
                {dispute.evidenceRequest?.isOverdue ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                    Überfällig
                  </span>
                ) : dispute.evidenceRequest ? (
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-200">
                    Angefordert
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    Kein Vorgang
                  </span>
                )}
              </div>

              {dispute.evidenceRequest ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Angefordert</p>
                      <p className="mt-1 text-sm font-semibold">{formatDateTime(dispute.evidenceRequest.requestedAt)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Frist</p>
                      <p className={`mt-1 text-sm font-semibold ${dispute.evidenceRequest.isOverdue ? 'text-red-600 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                        {formatDateTime(dispute.evidenceRequest.dueAt)}
                      </p>
                    </div>
                  </div>

                  {dispute.evidenceRequest.missingEvidence?.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Offen
                      </p>
                      <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                        {dispute.evidenceRequest.missingEvidence.slice(0, 4).map((item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-yellow-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Prüfung</p>
                      <p className="mt-1 text-sm font-semibold">
                        {dispute.evidenceRequest.reviewedAt ? formatDateTime(dispute.evidenceRequest.reviewedAt) : 'Offen'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Auto-Entscheidung</p>
                      <p className={`mt-1 text-sm font-semibold ${
                        autoResolutionState === 'blocked'
                          ? 'text-red-600 dark:text-red-300'
                          : autoResolutionState === 'approved'
                            ? 'text-green-600 dark:text-green-300'
                            : ''
                      }`}>
                        {getAutoResolutionLabel(autoResolutionState)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Für diesen Streitfall wurden noch keine zusätzlichen Nachweise angefordert.
                </p>
              )}

              {latestSupportTicket && (
                <div className="mt-4 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Support Ticket</p>
                      <p className="font-mono text-sm font-semibold">{latestSupportTicket.id}</p>
                    </div>
                    <StatusBadge status={latestSupportTicket.status || 'open'} size="sm" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Priorität: {latestSupportTicket.priority || 'NORMAL'} · Aktualisiert: {formatDateTime(latestSupportTicket.updatedAt)}
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <textarea
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  rows={2}
                  placeholder="Interne Notiz für Audit Trail..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => runDisputeAction('MARK_EVIDENCE_REVIEWED')}
                    disabled={Boolean(actionLoading)}
                    className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === 'MARK_EVIDENCE_REVIEWED' ? 'Prüfe...' : 'Nachweise geprüft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => runDisputeAction('EXTEND_EVIDENCE_DEADLINE', {
                      dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
                    })}
                    disabled={Boolean(actionLoading) || !dispute.evidenceRequest}
                    className="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-semibold text-gray-950 transition hover:bg-yellow-400 disabled:opacity-50"
                  >
                    {actionLoading === 'EXTEND_EVIDENCE_DEADLINE' ? 'Verlängere...' : 'Frist +48h'}
                  </button>
                  <button
                    type="button"
                    onClick={() => runDisputeAction('CLOSE_SUPPORT_TICKET', { ticketId: latestSupportTicket?.id })}
                    disabled={Boolean(actionLoading) || !latestSupportTicket || isLatestSupportTicketClosed}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    {actionLoading === 'CLOSE_SUPPORT_TICKET' ? 'Schließe...' : 'Ticket schließen'}
                  </button>
                  <button
                    type="button"
                    onClick={() => runDisputeAction(
                      autoResolutionState === 'blocked' ? 'APPROVE_AUTO_RESOLUTION' : 'BLOCK_AUTO_RESOLUTION'
                    )}
                    disabled={Boolean(actionLoading)}
                    className="rounded-lg border border-blue-500/30 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50 dark:text-blue-200 dark:hover:bg-blue-900/30"
                  >
                    {actionLoading === 'BLOCK_AUTO_RESOLUTION' || actionLoading === 'APPROVE_AUTO_RESOLUTION'
                      ? 'Speichere...'
                      : autoResolutionState === 'blocked'
                        ? 'Auto freigeben'
                        : 'Auto sperren'}
                  </button>
                </div>
              </div>
            </div>

            {/* Decision Recommendation */}
            <div className="rounded-lg border border-blue-500/20 bg-[#06121C] p-6 shadow-xl shadow-blue-950/20">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                    KI Streitfall-Analyse
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    Entscheidungsempfehlung
                  </h3>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${recommendation ? recommendationRiskClass(recommendation.riskLevel) : 'border-blue-500/30 bg-blue-500/10 text-blue-200'}`}>
                  {recommendationLoading ? 'Analyse...' : recommendation ? recommendation.riskLevel.toUpperCase() : 'WARTET'}
                </span>
              </div>

              {recommendationLoading && (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  Analyse wird mit Fall-, Zahlungs- und Nachweisdaten erstellt.
                </div>
              )}

              {!recommendationLoading && recommendation && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-slate-400">Empfehlung</p>
                      <p className="mt-1 text-sm font-semibold text-white">{recommendation.actionLabel}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-slate-400">Vertrauen</p>
                      <p className="mt-1 text-sm font-semibold text-white">{recommendation.confidence}%</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-slate-400">Betrag</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {recommendation.suggestedRefundAmountCents
                          ? formatCurrency(recommendation.suggestedRefundAmountCents, recommendation.currency)
                          : 'Keine Erstattung'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs text-slate-400">Modus</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {recommendation.requiresAdminApproval ? 'Admin-Freigabe' : 'Auto-Close möglich'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Begründung</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-200">
                      {recommendation.reasons.slice(0, 3).map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {recommendation.missingEvidence.length > 0 && (
                    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-yellow-200">
                        Fehlende Nachweise
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-yellow-50">
                        {recommendation.missingEvidence.slice(0, 2).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {recommendation.signals.slice(0, 4).map((signal) => (
                      <span key={`${signal.label}-${signal.value}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {signal.label}: {signal.value}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={applyRecommendation}
                      className="flex-1 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#06121C] transition hover:bg-cyan-300"
                    >
                      Empfehlung übernehmen
                    </button>
                    <button
                      type="button"
                      onClick={requestEvidenceWorkflow}
                      disabled={requestingEvidence}
                      className="flex-1 rounded-lg border border-yellow-300/30 bg-yellow-300/10 px-4 py-2 text-sm font-semibold text-yellow-100 transition hover:bg-yellow-300/20 disabled:opacity-50"
                    >
                      {requestingEvidence ? 'Wird angefordert...' : 'Nachweise anfordern'}
                    </button>
                    <button
                      type="button"
                      onClick={() => loadRecommendation(dispute)}
                      className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Aktualisieren
                    </button>
                  </div>

                  {workflowMessage && (
                    <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">
                      {workflowMessage}
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    Quelle: {recommendationSource === 'live' ? 'Live Backend' : recommendationSource === 'fallback' ? 'Backend-Fallback' : 'Lokale Analyse'} - keine automatische Auszahlung ohne Freigabe.
                  </p>
                </div>
              )}
            </div>

            {/* Resolution Form */}
            {canResolve && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Dispute auflösen
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Entscheidung
                    </label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value as any)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    >
                      <option value="reject">Ablehnen (Keine Erstattung)</option>
                      <option value="refund_full">Volle Erstattung</option>
                      <option value="refund_partial">Teilerstattung</option>
                      <option value="other">Kulanz / Sonstige Lösung</option>
                    </select>
                  </div>

                  {resolutionType === 'refund_partial' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Erstattungsbetrag (EUR)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={partialAmount}
                        onChange={(e) => setPartialAmount(e.target.value)}
                        placeholder={`Max: ${formatCurrency(dispute.paymentAmountCents, dispute.currency)}`}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bemerkung
                    </label>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      rows={3}
                      placeholder="Optionale Bemerkung zur Entscheidung..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                    />
                  </div>

                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={submitting}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Dispute auflösen
                  </button>
                </div>
              </div>
            )}

            {/* Existing Resolution */}
            {dispute.status === 'resolved' && dispute.resolution && (
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                  Gelöst
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Entscheidung: {dispute.resolution === 'refund_full' ? 'Volle Erstattung' : 
                    dispute.resolution === 'refund_partial' ? 'Teilerstattung' : 
                    dispute.resolution === 'reject' ? 'Abgelehnt' : 'Sonstige'}
                </p>
                {dispute.refundAmountCents && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Erstattet: {formatCurrency(dispute.refundAmountCents, dispute.currency)}
                  </p>
                )}
                {dispute.resolutionNote && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    {dispute.resolutionNote}
                  </p>
                )}
              </div>
            )}

            {/* Audit Trail */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Audit Trail
              </h3>
              {dispute.auditTrail?.length ? (
                <div className="space-y-3">
                  {dispute.auditTrail.slice(0, 6).map((event) => (
                    <div key={event.id} className="border-l-2 border-blue-500/50 pl-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {getAuditLabel(event.eventType)}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(event.createdAt)}
                        </span>
                      </div>
                      {(event.oldStatus || event.newStatus) && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {event.oldStatus || '-'} → {event.newStatus || '-'}
                        </p>
                      )}
                      {Array.isArray(event.metadata?.missingEvidence) && (
                        <p className="mt-1 text-xs text-yellow-700 dark:text-yellow-300">
                          {event.metadata.missingEvidence.length} Nachweise angefordert
                        </p>
                      )}
                      {event.metadata?.leadId && (
                        <p className="mt-1 text-xs text-cyan-700 dark:text-cyan-300">
                          Lead {event.metadata.leadId} · {event.metadata.provider || 'Versicherungspartner'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Noch keine Audit-Ereignisse vorhanden.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleResolve}
        title="Dispute auflösen"
        message={`Möchten Sie diesen Dispute wirklich ${
          resolutionType === 'refund_full' ? 'mit voller Erstattung' :
          resolutionType === 'refund_partial' ? 'mit Teilerstattung' :
          resolutionType === 'reject' ? 'ohne Erstattung' : 'anders'
        } auflösen?`}
        confirmLabel="Auflösen"
        variant={resolutionType === 'reject' ? 'warning' : 'info'}
        loading={submitting}
      />
    </AdminLayout>
  );
}
