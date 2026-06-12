'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Headphones,
  LayoutDashboard,
  MapPin,
  Megaphone,
  PackageCheck,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthStore, type UserRole } from '@/lib/auth-store';
import { getPlatformOperatingModel } from '@/lib/product-operating-model';

type PreviewLogin = {
  label: string;
  role: UserRole;
  group: 'customers' | 'carrierTeam' | 'internal';
  accountTypeLabel: string;
  memberRoleLabel: string;
  email: string;
  password: string;
  target: string;
  dashboardTarget: string;
  description: string;
  accent: string;
  icon: ReactNode;
};

type HealthPayload = {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  checks?: {
    database?: {
      status: 'ok' | 'error' | 'warning';
      score?: number;
      missingCount?: number;
      warningCount?: number;
      migrationCommand?: string;
    };
    stripe?: {
      status: 'ok' | 'warning' | 'error';
      score?: number;
      missingCount?: number;
      warningCount?: number;
    };
    operations?: {
      status: 'ok' | 'warning' | 'error';
      score?: number;
      missingCount?: number;
      warningCount?: number;
      cronJobCount?: number;
    };
  };
};

const previewLogins: PreviewLogin[] = [
  {
    label: 'Verlader Gewerbe',
    role: 'SHIPPER_COMPANY',
    group: 'customers',
    accountTypeLabel: 'Gewerblicher Verlader',
    memberRoleLabel: 'Firmenadmin',
    email: 'shipper@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=shipper',
    description: 'Firmenkunde mit Transporten, Angeboten, Zahlungsschutz, Rechnungen und KYB-Dokumenten.',
    accent: '#1C7ED6',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    label: 'Verlader Privat',
    role: 'SHIPPER_PRIVATE',
    group: 'customers',
    accountTypeLabel: 'Privater Verlader',
    memberRoleLabel: 'Privatperson',
    email: 'shipper.private@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=SHIPPER_PRIVATE',
    description: 'Privatperson für einzelne Transporte mit KYC, Angeboten, Zahlung und Sendungsdokumenten.',
    accent: '#1C7ED6',
    icon: <UserRound className="h-5 w-5" />,
  },
  {
    label: 'Spedition Owner',
    role: 'CARRIER',
    group: 'customers',
    accountTypeLabel: 'Spedition / Transporteur',
    memberRoleLabel: 'Inhaber / Firmenadmin',
    email: 'carrier@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=carrier',
    description: 'Hauptkonto für Aufträge, Angebote, Flotte, Fahrer, Auszahlungen, Abrechnung und Teamverwaltung.',
    accent: '#00D4FF',
    icon: <Truck className="h-5 w-5" />,
  },
  {
    label: 'Solo-Transporteur',
    role: 'DRIVER_SELF_EMPLOYED',
    group: 'customers',
    accountTypeLabel: 'Kleingewerbe Transport',
    memberRoleLabel: 'Inhaber + Fahrer',
    email: 'driver@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=driver',
    description: 'Für selbstständige Fahrer: verfügbare Jobs, aktuelle Tour, Dokumente und eigener Verdienst.',
    accent: '#2ECC71',
    icon: <UserRound className="h-5 w-5" />,
  },
  {
    label: 'Spedition Disposition',
    role: 'DISPATCHER',
    group: 'carrierTeam',
    accountTypeLabel: 'Spedition / Transporteur',
    memberRoleLabel: 'Unterrolle: Dispatcher',
    email: 'dispatcher@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=dispatcher',
    description: 'Teamrolle innerhalb der Spedition. Plant Touren, weist Fahrer zu und nutzt KI-Matching.',
    accent: '#00D4FF',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: 'Support',
    role: 'SUPPORT',
    group: 'internal',
    accountTypeLabel: 'CargoBit intern',
    memberRoleLabel: 'Support Agent',
    email: 'support@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=support',
    description: 'Support-Ansicht für Tickets, Streitfälle, Benutzer und KI-Assistenz.',
    accent: '#F39C12',
    icon: <Headphones className="h-5 w-5" />,
  },
  {
    label: 'Marketer',
    role: 'MARKETER',
    group: 'internal',
    accountTypeLabel: 'CargoBit intern',
    memberRoleLabel: 'Marketing',
    email: 'marketer@cargobit.eu',
    password: 'demo123',
    target: '/',
    dashboardTarget: '/dashboard?role=marketer',
    description: 'Marketing-Dashboard für Kampagnen, Partner, Analytics und Reports.',
    accent: '#1C7ED6',
    icon: <Megaphone className="h-5 w-5" />,
  },
  {
    label: 'Admin',
    role: 'ADMIN',
    group: 'internal',
    accountTypeLabel: 'CargoBit intern',
    memberRoleLabel: 'Plattform Admin',
    email: 'admin@cargobit.eu',
    password: 'demo123',
    target: '/admin/dashboard',
    dashboardTarget: '/admin/dashboard',
    description: 'Admin Dashboard mit Plattform-KPIs, Europa-Map, Systemstatus und Aktivitäten.',
    accent: '#E74C3C',
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const previewSections = [
  {
    key: 'customers',
    title: 'Kundenkonten',
    description: 'Die eigentlichen Plattform-Teilnehmer: Verlader, kleine Transport-Gewerbe und Speditionen.',
  },
  {
    key: 'carrierTeam',
    title: 'Spedition Teamrollen',
    description: 'Interne Rollen unter einem Speditionskonto. Sie sind keine eigene Kundengruppe.',
  },
  {
    key: 'internal',
    title: 'CargoBit intern',
    description: 'Rollen für Plattformbetrieb, Support, Marketing und Administration.',
  },
] as const;

export default function PreviewPage() {
  const router = useRouter();
  const { login, logout, user, isAuthenticated } = useAuthStore();
  const operatingModel = getPlatformOperatingModel(user?.role || 'carrier');
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  async function loginAs(item: PreviewLogin, target = item.target) {
    const ok = await login(item.email, item.password);
    if (ok) router.push(target);
  }

  async function copyCredentials(item: PreviewLogin) {
    await navigator.clipboard.writeText(`${item.email}\n${item.password}`);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      setHealthLoading(true);
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const data = await response.json();
        if (!cancelled) setHealth(data);
      } catch {
        if (!cancelled) {
          setHealth({
            status: 'error',
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    }

    loadHealth();
    const interval = window.setInterval(loadHealth, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#06121C] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 rounded-[18px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1C7ED6] shadow-lg shadow-[#1C7ED6]/30">
                <BadgeCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#00D4FF]">CargoBit Test Preview</p>
                <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Rollen & Demo-Logins</h1>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-white/65">
              Nutze diese Seite zum schnellen Testen der App. Alle Demo-Konten verwenden dasselbe Passwort.
              Die Ein-Klick-Buttons setzen den lokalen Test-Login und öffnen direkt den passenden Bereich.
              Dispatcher ist jetzt bewusst als Unterrolle der Spedition eingeordnet.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70 sm:min-w-[280px]">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Badge className={isAuthenticated ? 'bg-[#2ECC71] text-[#06121C]' : 'bg-white/10 text-white'}>
                {isAuthenticated ? 'Eingeloggt' : 'Nicht eingeloggt'}
              </Badge>
            </div>
            <div className="text-white">
              {user
                ? `${user.firstName} ${user.lastName} · ${user.accountType || user.role} · ${user.organizationRole || user.role}`
                : 'Kein lokaler Demo-User aktiv'}
            </div>
            {isAuthenticated ? (
              <Button
                variant="outline"
                className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={logout}
              >
                Demo-Login zurücksetzen
              </Button>
            ) : null}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[18px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[#00D4FF]">Produktfokus</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal">Trust → Auftrag → POD → Rechnung → Auszahlung</h2>
              </div>
              <Link
                href="/driver/mobile"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2ECC71] px-4 py-2.5 text-sm font-semibold text-[#06121C] transition hover:brightness-110"
              >
                Fahrer Mobile
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              {operatingModel.lifecycle.slice(0, 4).map((stage, index) => (
                <div key={stage.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40">0{index + 1}</span>
                    {index < 2 ? (
                      <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" />
                    ) : (
                      <Route className="h-4 w-4 text-[#00D4FF]" />
                    )}
                  </div>
                  <p className="font-semibold text-white">{stage.label}</p>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/50">{stage.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[18px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#00D4FF]">Startnische</p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal">DACH & Benelux zuerst</h2>
              </div>
              <div className="rounded-2xl border border-[#F39C12]/25 bg-[#F39C12]/10 p-3 text-[#F39C12]">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-3">
              {operatingModel.nicheMarketLanes.slice(0, 3).map((lane) => (
                <div key={lane.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{lane.label}</p>
                    <Badge className="bg-[#00D4FF]/10 text-[#00D4FF]">{lane.fitScore}%</Badge>
                  </div>
                  <p className="text-xs leading-5 text-white/50">{lane.cargo}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <TrustPreviewCard icon={<ShieldCheck className="h-5 w-5" />} title="Vertrauen" detail="KYC/KYB, Versicherung, Lizenz, Bewertung und Zahlungsabsicherung werden als Trust Score gebündelt." />
          <TrustPreviewCard icon={<Wallet className="h-5 w-5" />} title="Zahlung" detail="Zahlungsschutz, Gebührenquote, Rechnung und Payout-Risk-Gate bilden den Geldfluss." />
          <TrustPreviewCard icon={<PackageCheck className="h-5 w-5" />} title="Ablieferung" detail="Mobile Fahreransicht führt Status, GPS, CMR/POD und Support direkt im Auftrag zusammen." />
        </section>

        <section className="rounded-[18px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/25 backdrop-blur-xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#00D4FF]">System-Readiness</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal">Preview Status</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">
                Live-Prüfung für App, Produktionsdatenbank, Stripe-Setup und automatische Cron-Jobs. Lokal ist ein roter DB-Status normal, solange keine Postgres-Datenbank verbunden ist.
              </p>
            </div>
            <Badge className={healthStatusClass(health?.status)}>
              {healthLoading ? 'Prüft...' : healthLabel(health?.status)}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <ReadinessMiniCard
              icon={<Activity className="h-5 w-5" />}
              title="App"
              status={health?.status || 'error'}
              value={healthLoading ? '...' : healthLabel(health?.status)}
              detail={health?.timestamp ? `Geprüft: ${new Date(health.timestamp).toLocaleTimeString('de-DE')}` : 'Noch keine Prüfung'}
            />
            <ReadinessMiniCard
              icon={<Database className="h-5 w-5" />}
              title="Datenbank"
              status={health?.checks?.database?.status || 'error'}
              value={`${health?.checks?.database?.score ?? 0}%`}
              detail={
                health?.checks?.database?.migrationCommand
                  ? `Offen: ${health.checks.database.migrationCommand}`
                  : `${health?.checks?.database?.missingCount ?? 0} offen, ${health?.checks?.database?.warningCount ?? 0} Hinweise`
              }
            />
            <ReadinessMiniCard
              icon={<CreditCard className="h-5 w-5" />}
              title="Stripe"
              status={health?.checks?.stripe?.status || 'warning'}
              value={`${health?.checks?.stripe?.score ?? 0}%`}
              detail={`${health?.checks?.stripe?.missingCount ?? 0} Pflichtwerte offen, ${health?.checks?.stripe?.warningCount ?? 0} Hinweise`}
            />
            <ReadinessMiniCard
              icon={<Activity className="h-5 w-5" />}
              title="Automatik"
              status={health?.checks?.operations?.status || 'warning'}
              value={`${health?.checks?.operations?.score ?? 0}%`}
              detail={`${health?.checks?.operations?.cronJobCount ?? 0} Cron Jobs, ${health?.checks?.operations?.missingCount ?? 0} offen`}
            />
          </div>
        </section>

        {previewSections.map((section) => {
          const items = previewLogins.filter((item) => item.group === section.key);

          return (
            <section key={section.key} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-normal">{section.title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">{section.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.email}
                    className="group rounded-[18px] border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-black/20 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-white/20"
                    style={{ boxShadow: `0 20px 70px rgba(0,0,0,0.25), 0 0 36px ${item.accent}16` }}
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                          style={{ background: `${item.accent}22`, color: item.accent }}
                        >
                          {item.icon}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{item.label}</h3>
                          <p className="text-xs text-white/45">{item.role}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-white/10 bg-white/5 text-white/75">
                        Demo
                      </Badge>
                    </div>

                    <div className="mb-4 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-white/40">Konto</p>
                        <p className="mt-1 font-medium text-white">{item.accountTypeLabel}</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <p className="text-white/40">Rolle</p>
                        <p className="mt-1 font-medium text-white">{item.memberRoleLabel}</p>
                      </div>
                    </div>

                    <p className="min-h-12 text-sm leading-6 text-white/62">{item.description}</p>

                    <div className="mt-5 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 font-mono text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/45">Email</span>
                        <span className="truncate text-white">{item.email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/45">Passwort</span>
                        <span className="text-white">{item.password}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <Button
                        className="bg-[#1C7ED6] text-white hover:bg-[#166BBB]"
                        onClick={() => loginAs(item)}
                      >
                        Login öffnen
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={() => loginAs(item, item.dashboardTarget)}
                      >
                        Dashboard
                      </Button>
                      <Button
                        variant="ghost"
                        className="sm:col-span-2 text-white/65 hover:bg-white/10 hover:text-white"
                        onClick={() => copyCredentials(item)}
                      >
                        <Copy className="h-4 w-4" />
                        Zugangsdaten kopieren
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <footer className="flex flex-col gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] p-5 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <span>Hinweis: Das sind lokale Demo-Logins für Preview und Rollen-Tests.</span>
          <div className="flex gap-3">
            <Link className="text-[#00D4FF] hover:text-white" href="/">
              Zur Startseite
            </Link>
            <Link className="text-[#00D4FF] hover:text-white" href="/admin/login">
              Admin Login
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}

function TrustPreviewCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <article className="rounded-[18px] border border-white/10 bg-white/[0.05] p-5 shadow-xl shadow-black/20 backdrop-blur-xl">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1C7ED6]/15 text-[#00D4FF]">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-normal">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/55">{detail}</p>
    </article>
  );
}

function ReadinessMiniCard({
  icon,
  title,
  status,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${readinessIconClass(status)}`}>
          {icon}
        </div>
        <Badge className={readinessBadgeClass(status)}>{status === 'ok' ? 'OK' : status === 'error' ? 'Offen' : 'Hinweis'}</Badge>
      </div>
      <p className="text-sm text-white/45">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-white/50">{detail}</p>
    </article>
  );
}

function healthLabel(status?: string) {
  if (status === 'ok') return 'Bereit';
  if (status === 'degraded') return 'Teilbereit';
  if (status === 'error') return 'Offen';
  return 'Unbekannt';
}

function healthStatusClass(status?: string) {
  if (status === 'ok') return 'bg-[#2ECC71] text-[#06121C]';
  if (status === 'degraded') return 'bg-[#F39C12] text-[#06121C]';
  return 'bg-[#E74C3C] text-white';
}

function readinessBadgeClass(status: string) {
  if (status === 'ok') return 'bg-[#2ECC71]/15 text-[#8ff0b9]';
  if (status === 'error') return 'bg-[#E74C3C]/15 text-[#ffb5ab]';
  return 'bg-[#F39C12]/15 text-[#ffd79a]';
}

function readinessIconClass(status: string) {
  if (status === 'ok') return 'bg-[#2ECC71]/15 text-[#8ff0b9]';
  if (status === 'error') return 'bg-[#E74C3C]/15 text-[#ffb5ab]';
  return 'bg-[#F39C12]/15 text-[#ffd79a]';
}
