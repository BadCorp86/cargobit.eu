const EVIDENCE_REQUEST_WINDOW_HOURS = 72;

export interface DisputeWorkflowAuditEvent {
  eventType: string;
  createdAt: Date;
  metadata?: string | null;
  adminId?: string | null;
}

export interface EvidenceWorkflowSummary {
  requestedAt: Date;
  dueAt: Date;
  isOverdue: boolean;
  missingEvidence: string[];
  reviewedAt: Date | null;
  reviewedBy: string | null;
  autoResolution: {
    state: 'default' | 'blocked' | 'approved';
    changedAt: Date | null;
    note: string | null;
  };
}

export function parseDisputeMetadata(value?: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function newestEvent(events: DisputeWorkflowAuditEvent[], eventType: string) {
  return events
    .filter((event) => event.eventType === eventType)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

export function buildEvidenceWorkflowSummary(events: DisputeWorkflowAuditEvent[]): EvidenceWorkflowSummary | null {
  const requested = newestEvent(events, 'evidence_requested');
  if (!requested) return null;

  const requestedMetadata = parseDisputeMetadata(requested.metadata);
  const extended = newestEvent(events, 'evidence_deadline_extended');
  const extensionMetadata = parseDisputeMetadata(extended?.metadata);
  const reviewed = newestEvent(events, 'evidence_reviewed');
  const blocked = newestEvent(events, 'auto_resolution_blocked');
  const approved = newestEvent(events, 'auto_resolution_approved');
  const latestAutoResolutionEvent =
    blocked && approved
      ? blocked.createdAt > approved.createdAt ? blocked : approved
      : blocked || approved;
  const latestAutoMetadata = parseDisputeMetadata(latestAutoResolutionEvent?.metadata);
  const extendedDueAt = getDate(extensionMetadata?.dueAt);
  const defaultDueAt = new Date(requested.createdAt.getTime() + EVIDENCE_REQUEST_WINDOW_HOURS * 60 * 60 * 1000);
  const dueAt = extendedDueAt && extendedDueAt > requested.createdAt ? extendedDueAt : defaultDueAt;

  return {
    requestedAt: requested.createdAt,
    dueAt,
    isOverdue: Date.now() > dueAt.getTime() && !reviewed,
    missingEvidence: Array.isArray(requestedMetadata?.missingEvidence) ? requestedMetadata.missingEvidence : [],
    reviewedAt: reviewed?.createdAt || null,
    reviewedBy: reviewed?.adminId || null,
    autoResolution: {
      state: latestAutoResolutionEvent?.eventType === 'auto_resolution_blocked'
        ? 'blocked'
        : latestAutoResolutionEvent?.eventType === 'auto_resolution_approved'
          ? 'approved'
          : 'default',
      changedAt: latestAutoResolutionEvent?.createdAt || null,
      note: typeof latestAutoMetadata?.note === 'string' ? latestAutoMetadata.note : null,
    },
  };
}
