'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Circle,
  Clock3,
  Headphones,
  Loader2,
  MapPin,
  Navigation,
  PackageCheck,
  Route,
  ShieldCheck,
  Upload,
  Wallet,
} from 'lucide-react';
import { getFallbackDriverMission } from '@/lib/product-operating-model';
import { useAuthStore } from '@/lib/auth-store';
import type { DriverMobileActionId } from '@/lib/driver-mobile';

type DriverMission = ReturnType<typeof getFallbackDriverMission> & {
  driver?: {
    id: string;
    rating: number;
    completedTransports: number;
    licenseClass?: string;
  };
  vehicle?: {
    id: string;
    label: string;
  };
};

export default function DriverMobilePage() {
  const { user } = useAuthStore();
  const fallback = useMemo(() => getFallbackDriverMission(), []);
  const [mission, setMission] = useState<DriverMission>(fallback);
  const [loading, setLoading] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<DriverMobileActionId | null>(null);
  const [invoiceHref, setInvoiceHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (user?.id) params.set('userId', user.id);

        const response = await fetch(`/api/driver/mobile?${params.toString()}`, {
          headers: user?.id ? { 'x-user-id': user.id } : undefined,
        });
        const payload = await response.json();

        if (!cancelled && payload?.mission) {
          setMission(payload.mission);
        }
      } catch {
        if (!cancelled) setMission(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [fallback, user?.id]);

  const doneCount = mission.checklist.filter((item) => item.done).length;
  const primaryAction = getPrimaryAction(mission);
  const primaryActionLabel = getActionLabel(primaryAction, mission.nextStop.action);

  const runDriverAction = async (action: DriverMobileActionId) => {
    if (action === 'contact_support') return;

    setActionPending(action);
    setLastAction(null);

    try {
      const response = await fetch('/api/driver/mobile/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-user-id': user.id } : {}),
        },
        body: JSON.stringify({
          action,
          missionId: mission.id,
          userId: user?.id,
          note: action === 'submit_pod'
            ? 'POD per mobiler Fahreransicht erfasst'
            : action === 'upload_photo'
              ? 'Lieferfoto per mobiler Fahreransicht erfasst'
              : undefined,
          podUrl: action === 'submit_pod' ? `/uploads/mobile/${mission.id}/pod-demo.jpg` : undefined,
          photoUrl: action === 'upload_photo' ? `/uploads/mobile/${mission.id}/delivery-demo.jpg` : undefined,
        }),
      });
      const payload = await response.json();

      if (payload?.mission) setMission(payload.mission);
      if (payload?.message) setLastAction(payload.message);
      setInvoiceHref(payload?.next === 'invoice_and_payout_ready'
        ? payload.orderDetailHref || payload.invoicePreviewHref
        : null);
    } catch {
      setLastAction('Aktion konnte lokal nicht gesendet werden. Bitte Verbindung pruefen.');
    } finally {
      setActionPending(null);
    }
  };

  return (
    <main className="dark min-h-screen bg-[#06121C] text-white" style={{ colorScheme: 'dark' }}>
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.16),transparent_45%),linear-gradient(180deg,#06121C,#071927_55%,#06121C)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <Link
            href="/dashboard?role=driver"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05] text-white/80"
            aria-label="Zurueck zum Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#00D4FF]">CargoBit Driver</p>
            <h1 className="text-base font-semibold tracking-normal">Mobile Tour</h1>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#2ECC71]/25 bg-[#2ECC71]/10 text-[#2ECC71]">
            <Navigation className="h-5 w-5" />
          </div>
        </header>

        <section className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.05] shadow-2xl shadow-black/35 backdrop-blur-xl">
          <div className="relative p-5">
            <div className="absolute right-5 top-5 rounded-full border border-[#2ECC71]/25 bg-[#2ECC71]/10 px-3 py-1 text-xs font-semibold text-[#2ECC71]">
              {loading ? 'Sync' : mission.status}
            </div>
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C7ED6]/20 text-[#00D4FF] shadow-lg shadow-[#1C7ED6]/20">
              <Route className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-semibold tracking-normal">{mission.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">{mission.subtitle}</p>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-white/55">Fortschritt</span>
                <span className="font-semibold text-white">{mission.progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] shadow-lg shadow-[#00D4FF]/30 transition-all"
                  style={{ width: `${mission.progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-white/[0.08]">
            <Metric icon={<Clock3 className="h-4 w-4" />} label="ETA" value={mission.nextStop.eta} />
            <Metric icon={<Wallet className="h-4 w-4" />} label="Payout" value={mission.payout} />
            <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Checks" value={`${doneCount}/${mission.checklist.length}`} />
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F39C12]/12 text-[#F39C12]">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.18em] text-white/35">Naechster Schritt</p>
              <h3 className="mt-1 text-lg font-semibold">{mission.nextStop.label}</h3>
              <p className="mt-1 text-sm text-white/55">{primaryActionLabel}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={Boolean(actionPending)}
            onClick={() => runDriverAction(primaryAction)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2ECC71] px-4 py-4 text-sm font-bold text-[#06121C] shadow-lg shadow-[#2ECC71]/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {actionPending === primaryAction ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
            {primaryActionLabel}
          </button>
          {lastAction && (
            <p className="mt-3 rounded-xl border border-[#2ECC71]/20 bg-[#2ECC71]/10 px-3 py-2 text-sm text-[#2ECC71]">
              {lastAction}
            </p>
          )}
          {invoiceHref && (
            <Link
              href={invoiceHref}
              className="mt-3 flex items-center justify-center rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 px-3 py-2 text-sm font-semibold text-[#00D4FF]"
            >
              Rechnungsvorschau / Payout Gate ansehen
            </Link>
          )}
        </section>

        <section className="mt-4 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
          <h3 className="mb-3 font-semibold">Tour Checkliste</h3>
          <div className="space-y-2">
            {mission.checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-[#2ECC71]" />
                ) : (
                  <Circle className="h-5 w-5 text-white/30" />
                )}
                <span className={item.done ? 'text-sm text-white' : 'text-sm text-white/55'}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <nav className="mt-4 grid grid-cols-3 gap-3">
          <MobileActionButton
            icon={<Upload className={actionPending === 'submit_pod' ? 'h-5 w-5 animate-spin' : 'h-5 w-5'} />}
            label="POD"
            disabled={Boolean(actionPending)}
            onClick={() => runDriverAction('submit_pod')}
          />
          <MobileActionButton
            icon={<Camera className={actionPending === 'upload_photo' ? 'h-5 w-5 animate-pulse' : 'h-5 w-5'} />}
            label="Foto"
            disabled={Boolean(actionPending)}
            onClick={() => runDriverAction('upload_photo')}
          />
          <MobileAction icon={<Headphones className="h-5 w-5" />} label="Support" href={mission.actions[2]?.href || '#'} />
        </nav>
      </div>
    </main>
  );
}

function getPrimaryAction(mission: DriverMission): DriverMobileActionId {
  const done = new Set(mission.checklist.filter((item) => item.done).map((item) => item.id));

  if (!done.has('pickup')) return 'confirm_pickup';
  if (!done.has('delivery')) return 'confirm_delivery';
  if (!done.has('pod')) return 'submit_pod';
  return 'send_status';
}

function getActionLabel(action: DriverMobileActionId, fallback: string) {
  switch (action) {
    case 'confirm_pickup':
      return 'Abholung bestaetigen';
    case 'confirm_delivery':
      return 'Lieferung bestaetigen';
    case 'submit_pod':
      return 'POD erfassen';
    case 'upload_photo':
      return 'Foto hochladen';
    case 'send_status':
      return 'Status senden';
    default:
      return fallback;
  }
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="border-r border-white/[0.08] p-4 last:border-r-0">
      <div className="mb-2 text-[#00D4FF]">{icon}</div>
      <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function MobileAction({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
    >
      <span className="text-[#00D4FF]">{icon}</span>
      {label}
    </Link>
  );
}

function MobileActionButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="text-[#00D4FF]">{icon}</span>
      {label}
    </button>
  );
}
