export type OperationsReadinessStatus = 'ready' | 'missing' | 'warning';

export interface OperationsReadinessCheck {
  id: string;
  label: string;
  description: string;
  required: boolean;
  status: OperationsReadinessStatus;
  detail?: string;
  maskedValue?: string;
}

export interface OperationsCronJob {
  label: string;
  path: string;
  schedule: string;
  description: string;
}

export interface OperationsReadinessReport {
  ready: boolean;
  score: number;
  missing: string[];
  warnings: string[];
  checks: OperationsReadinessCheck[];
  cronJobs: OperationsCronJob[];
  checkedAt: string;
}

const CRON_JOBS: OperationsCronJob[] = [
  {
    label: 'Payment Reconciliation',
    path: '/api/cron/reconcile',
    schedule: '0 * * * *',
    description: 'Stündliche Prüfung von Zahlungen, Refunds und Reconciliation-Abweichungen.',
  },
  {
    label: 'Payout Processing',
    path: '/api/cron/payouts/run',
    schedule: '30 4 * * *',
    description: 'Tägliche Verarbeitung und Prüfung von Auszahlungen.',
  },
];

export function getOperationsReadiness(): OperationsReadinessReport {
  const checks: OperationsReadinessCheck[] = [
    createSecretCheck(
      'CRON_SECRET',
      'Cron Secret',
      'Schützt Cron- und Worker-Routen vor unbefugtem manuellen Auslösen.',
      true,
      24,
    ),
    {
      id: 'vercel_cron_jobs',
      label: 'Geplante Jobs',
      description: 'Reconciliation und Payout-Verarbeitung müssen auf dem Zielserver geplant werden, z. B. per systemd timer, cron oder Vercel Cron im Testbetrieb.',
      required: true,
      status: CRON_JOBS.length >= 2 ? 'ready' : 'missing',
      detail: CRON_JOBS.length >= 2 ? undefined : 'Mindestens Reconciliation und Payout Cron müssen registriert sein.',
    },
    {
      id: 'runtime_environment',
      label: 'Runtime Umgebung',
      description: 'In Production werden fehlende Cron-Secrets hart blockiert; lokal und in Testumgebungen bleibt Testbetrieb möglich.',
      required: false,
      status: process.env.NODE_ENV === 'production' ? 'ready' : 'warning',
      detail: process.env.NODE_ENV === 'production' ? undefined : 'Aktuell läuft die App nicht im Production-Modus.',
    },
  ];

  const requiredChecks = checks.filter((check) => check.required);
  const readyRequired = requiredChecks.filter((check) => check.status === 'ready').length;
  const missing = requiredChecks
    .filter((check) => check.status === 'missing')
    .map((check) => check.id);
  const warnings = checks
    .filter((check) => check.status === 'warning' || check.detail)
    .map((check) => `${check.label}: ${check.detail || 'Prüfung hat einen Hinweis ergeben.'}`);

  return {
    ready: missing.length === 0 && requiredChecks.every((check) => check.status === 'ready'),
    score: requiredChecks.length === 0 ? 100 : Math.round((readyRequired / requiredChecks.length) * 100),
    missing,
    warnings,
    checks,
    cronJobs: CRON_JOBS,
    checkedAt: new Date().toISOString(),
  };
}

export function withoutMaskedOperationsValues(report: OperationsReadinessReport): OperationsReadinessReport {
  return {
    ...report,
    checks: report.checks.map((check) => ({
      ...check,
      maskedValue: undefined,
    })),
  };
}

function createSecretCheck(
  key: string,
  label: string,
  description: string,
  required: boolean,
  minLength: number,
): OperationsReadinessCheck {
  const value = process.env[key] || '';
  const configured = isMeaningfulValue(value) && value.length >= minLength;

  return {
    id: key.toLowerCase(),
    label,
    description,
    required,
    status: configured ? 'ready' : required ? 'missing' : 'warning',
    maskedValue: configured ? maskValue(value) : undefined,
    detail: configured ? undefined : `${key} muss mindestens ${minLength} Zeichen lang sein.`,
  };
}

function isMeaningfulValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return !['replace', 'placeholder', 'changeme'].some((placeholder) => normalized.includes(placeholder));
}

function maskValue(value: string) {
  if (value.length <= 12) return 'konfiguriert';
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
