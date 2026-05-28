'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileText,
  Headphones,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Package,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Truck,
  UserPlus,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import { KpiCard, KpiGrid } from '@/components/kpi/KpiCard';
import {
  DashboardRole,
  RoleAction,
  RoleDashboardData,
  RoleDashboardUser,
  RoleMetricColor,
  getRoleDashboardData,
  normalizeDashboardRole,
} from '@/lib/role-dashboard-data';
import {
  getFallbackTrustProfile,
  getRoleNextSteps,
  type RoleNextStep,
} from '@/lib/product-operating-model';

interface PremiumRoleDashboardProps {
  user?: RoleDashboardUser;
  roleOverride?: DashboardRole;
  onLogout?: () => void;
  onNewTransport?: () => void;
}

const roleAccent: Record<DashboardRole, string> = {
  shipper: '#1C7ED6',
  carrier: '#00D4FF',
  driver: '#2ECC71',
  dispatcher: '#00D4FF',
  support: '#F39C12',
  marketer: '#1C7ED6',
};

const roleNav: Record<DashboardRole, Array<{ label: string; href: string; icon: ReactNode }>> = {
  shipper: [
    { label: 'Dashboard', href: '/dashboard?role=shipper', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Transporte', href: '/shipper/transports', icon: <Package className="h-5 w-5" /> },
    { label: 'Angebote', href: '/shipper/offers', icon: <Route className="h-5 w-5" /> },
    { label: 'Wallet', href: '/shipper/wallet', icon: <Wallet className="h-5 w-5" /> },
    { label: 'Abo', href: '/billing', icon: <CreditCardIcon /> },
    { label: 'Dokumente', href: '/shipper/documents', icon: <FileText className="h-5 w-5" /> },
  ],
  carrier: [
    { label: 'Dashboard', href: '/dashboard?role=carrier', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Loads', href: '/carrier/loads', icon: <Package className="h-5 w-5" /> },
    { label: 'Disposition', href: '/dashboard?role=dispatcher', icon: <Target className="h-5 w-5" /> },
    { label: 'Flotte', href: '/carrier/fleet', icon: <Truck className="h-5 w-5" /> },
    { label: 'Fahrer', href: '/carrier/drivers', icon: <UsersRound className="h-5 w-5" /> },
    { label: 'Wallet', href: '/carrier/wallet', icon: <Wallet className="h-5 w-5" /> },
    { label: 'Abo', href: '/billing', icon: <CreditCardIcon /> },
  ],
  driver: [
    { label: 'Dashboard', href: '/dashboard?role=driver', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Mobile App', href: '/driver/mobile', icon: <Route className="h-5 w-5" /> },
    { label: 'Mein Auftrag', href: '/driver/job', icon: <Truck className="h-5 w-5" /> },
    { label: 'Navigation', href: '/driver/navigation', icon: <Map className="h-5 w-5" /> },
    { label: 'Dokumente', href: '/driver/documents', icon: <FileText className="h-5 w-5" /> },
    { label: 'Verdienst', href: '/driver/earnings', icon: <Wallet className="h-5 w-5" /> },
  ],
  dispatcher: [
    { label: 'Dashboard', href: '/dashboard?role=dispatcher', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Matching', href: '/api/dispatcher/suggestions', icon: <Target className="h-5 w-5" /> },
    { label: 'Touren', href: '/carrier/dispatch/tours', icon: <Route className="h-5 w-5" /> },
    { label: 'Flotte', href: '/carrier/fleet', icon: <Truck className="h-5 w-5" /> },
    { label: 'KI Regeln', href: '/ml', icon: <Sparkles className="h-5 w-5" /> },
  ],
  support: [
    { label: 'Dashboard', href: '/dashboard?role=support', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Tickets', href: '/support/tickets', icon: <Headphones className="h-5 w-5" /> },
    { label: 'Streitfälle', href: '/admin/disputes', icon: <AlertTriangle className="h-5 w-5" /> },
    { label: 'Benutzer', href: '/support/users', icon: <UsersRound className="h-5 w-5" /> },
    { label: 'KI Assist', href: '/support/ai', icon: <Sparkles className="h-5 w-5" /> },
  ],
  marketer: [
    { label: 'Dashboard', href: '/dashboard?role=marketer', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: 'Kampagnen', href: '/marketer/campaigns', icon: <Target className="h-5 w-5" /> },
    { label: 'Partner', href: '/marketer/partners', icon: <UsersRound className="h-5 w-5" /> },
    { label: 'Analytics', href: '/marketer/analytics', icon: <Route className="h-5 w-5" /> },
    { label: 'Reports', href: '/marketer/reports', icon: <FileText className="h-5 w-5" /> },
  ],
};

const iconMap = {
  package: <Package className="h-6 w-6" />,
  route: <Route className="h-6 w-6" />,
  wallet: <Wallet className="h-6 w-6" />,
  users: <UsersRound className="h-6 w-6" />,
  shield: <ShieldCheck className="h-6 w-6" />,
  alert: <AlertTriangle className="h-6 w-6" />,
  truck: <Truck className="h-6 w-6" />,
  headphones: <Headphones className="h-6 w-6" />,
  target: <Target className="h-6 w-6" />,
};

const actionIconMap = {
  plus: <Plus className="h-5 w-5" />,
  user: <UserPlus className="h-5 w-5" />,
  shield: <ShieldCheck className="h-5 w-5" />,
  file: <FileText className="h-5 w-5" />,
  wallet: <Wallet className="h-5 w-5" />,
  map: <Map className="h-5 w-5" />,
  headphones: <Headphones className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
};

function CreditCardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H6a3 3 0 01-3-3V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h.01M11 15h2" />
    </svg>
  );
}

const cityPositions: Record<string, { x: number; y: number }> = {
  Hamburg: { x: 42, y: 28 },
  Berlin: { x: 57, y: 34 },
  München: { x: 52, y: 64 },
  Munich: { x: 52, y: 64 },
  Paris: { x: 31, y: 55 },
  Warschau: { x: 72, y: 37 },
  Warsaw: { x: 72, y: 37 },
  Mailand: { x: 52, y: 77 },
  Milan: { x: 52, y: 77 },
  Barcelona: { x: 20, y: 82 },
  Bremen: { x: 39, y: 32 },
  Kiel: { x: 43, y: 20 },
  Lübeck: { x: 48, y: 25 },
  Köln: { x: 35, y: 46 },
  Frankfurt: { x: 43, y: 52 },
  Stuttgart: { x: 46, y: 62 },
};

function actionHref(action: RoleAction, data: RoleDashboardData, onNewTransport?: () => void) {
  if (data.role === 'shipper' && action.icon === 'plus' && onNewTransport) {
    return undefined;
  }

  return action.href;
}

function statusToneClass(tone: string) {
  switch (tone) {
    case 'success':
      return 'border-[#2ECC71]/25 bg-[#2ECC71]/10 text-[#2ECC71]';
    case 'warning':
      return 'border-[#F39C12]/25 bg-[#F39C12]/10 text-[#F39C12]';
    case 'danger':
      return 'border-[#E74C3C]/25 bg-[#E74C3C]/10 text-[#E74C3C]';
    default:
      return 'border-[#00D4FF]/25 bg-[#00D4FF]/10 text-[#00D4FF]';
  }
}

function roleApiParams(role: DashboardRole, user?: RoleDashboardUser) {
  const params = new URLSearchParams({ role });
  if (user?.id) params.set('id', user.id);
  if (user?.firstName) params.set('firstName', user.firstName);
  if (user?.lastName) params.set('lastName', user.lastName);
  if (user?.companyName) params.set('companyName', user.companyName);
  if (user?.email) params.set('email', user.email);
  if (user?.role) params.set('userRole', user.role);
  if (user?.accountType) params.set('accountType', user.accountType);
  if (user?.organizationRole) params.set('organizationRole', user.organizationRole);
  return params.toString();
}

export function PremiumRoleDashboard({
  user,
  roleOverride,
  onLogout,
  onNewTransport,
}: PremiumRoleDashboardProps) {
  const role = roleOverride || normalizeDashboardRole(user?.role);
  const fallbackData = useMemo(() => getRoleDashboardData(role, user), [role, user]);
  const [data, setData] = useState<RoleDashboardData>(fallbackData);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/dashboard/role?${roleApiParams(role, user)}`, {
          headers: {
            ...(user?.id ? { 'x-user-id': user.id } : {}),
            ...(user?.email ? { 'x-user-email': user.email } : {}),
          },
        });
        if (!response.ok) {
          throw new Error('Dashboard API failed');
        }
        const payload = await response.json();
        if (!cancelled && payload?.data) {
          setData(payload.data);
        }
      } catch {
        if (!cancelled) {
          setData(fallbackData);
        }
      }
    };

    setData(fallbackData);
    load();

    return () => {
      cancelled = true;
    };
  }, [fallbackData, role, user]);

  const accent = roleAccent[data.role];
  const productNextSteps = getRoleNextSteps(data.role);
  const trustProfile = getFallbackTrustProfile(data.role);

  return (
    <div className="dark min-h-screen overflow-hidden bg-[#06121C] text-white" style={{ colorScheme: 'dark' }}>
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(180deg,#06121C_0%,#071927_48%,#06121C_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(28,126,214,0.2),transparent_42%),radial-gradient(ellipse_at_top_right,rgba(0,212,255,0.16),transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] border-r border-white/[0.08] bg-[#06121C]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/[0.08] px-5">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${accent}, #00D4FF)`,
              boxShadow: `0 0 28px ${accent}45`,
            }}
          >
            <Truck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold tracking-tight">CargoBit</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">{data.roleLabel}</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-2 text-white/70 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Menü schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {roleNav[data.role].map((item, index) => (
            <Link
              href={item.href}
              key={item.label}
              className={`group flex items-center gap-3 rounded-[14px] px-3 py-3 text-sm transition-all ${
                index === 0
                  ? 'bg-[#1C7ED6]/20 text-white shadow-lg shadow-[#1C7ED6]/10'
                  : 'text-white/60 hover:bg-white/[0.05] hover:text-white'
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={index === 0 ? 'text-[#00D4FF]' : 'text-white/50 group-hover:text-white/80'}>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.08] p-4">
          <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.04] p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
                style={{ background: `${accent}24`, color: accent }}
              >
                {data.userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{data.userName}</p>
                <p className="truncate text-xs text-white/40">{data.companyName || data.roleLabel}</p>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#E74C3C]/20 bg-[#E74C3C]/10 px-3 py-2 text-sm font-medium text-[#E74C3C] transition-colors hover:bg-[#E74C3C]/18"
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </button>
            )}
          </div>
        </div>
      </aside>

      <div className="relative min-h-screen lg:ml-[260px]">
        <header className="sticky top-0 z-30 h-20 border-b border-white/[0.08] bg-[#06121C]/85 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-white/[0.08] bg-white/[0.05] p-2 text-white lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Menü öffnen"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-white">{data.title}</h1>
                <p className="hidden truncate text-sm text-white/40 xl:block">{data.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden items-center lg:flex">
                <div className="absolute inset-0 rounded-xl border border-white/[0.08] bg-white/[0.05]" />
                <Search className="absolute left-3 h-4 w-4 text-white/40" />
                <input
                  className="relative w-56 bg-transparent py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/40 outline-none"
                  placeholder="Suchen..."
                />
              </div>
              <button
                type="button"
                className="relative rounded-xl border border-white/[0.08] bg-white/[0.05] p-2.5 text-white/70 transition-colors hover:bg-white/[0.08]"
                aria-label="Benachrichtigungen"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E74C3C] text-[10px] font-bold text-white">3</span>
              </button>
              <ActionButton action={data.primaryAction} data={data} onNewTransport={onNewTransport} compact />
            </div>
          </div>
        </header>

        <main className="space-y-6 p-4 sm:p-5 lg:p-6 xl:p-7">
          <KpiGrid columns={4}>
            {data.kpis.map((kpi, index) => (
              <KpiCard
                key={kpi.title}
                color={kpi.color as RoleMetricColor}
                delay={index * 0.06}
                icon={iconMap[kpi.icon]}
                miniChartData={kpi.miniChartData}
                title={kpi.title}
                value={kpi.value}
                change={kpi.change}
                changeLabel={kpi.changeLabel}
              />
            ))}
          </KpiGrid>

          <ProductFocusCard
            role={data.role}
            accent={accent}
            trustScore={trustProfile.score}
            trustTitle={trustProfile.title}
            nextSteps={productNextSteps}
          />

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="min-w-0 space-y-6">
              <RouteControlCard data={data} />
              <WorkQueueCard data={data} />
            </div>

            <aside className="min-w-0 space-y-6">
              <QuickActionCard data={data} onNewTransport={onNewTransport} />
              <StatusCard data={data} />
              <InsightCard data={data} />
              <DistributionCard data={data} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function ActionButton({
  action,
  data,
  onNewTransport,
  compact = false,
}: {
  action: RoleAction;
  data: RoleDashboardData;
  onNewTransport?: () => void;
  compact?: boolean;
}) {
  const href = actionHref(action, data, onNewTransport);
  const className = `relative flex items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-transform hover:scale-[1.02] ${
    compact ? 'min-w-12 sm:min-w-40' : 'w-full'
  }`;
  const style = {
    background: `linear-gradient(135deg, ${action.color}, #00D4FF)`,
    boxShadow: `0 0 24px ${action.color}40`,
  };
  const content = (
    <>
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
      <span className="relative z-10">{actionIconMap[action.icon]}</span>
      <span className={`relative z-10 ${compact ? 'hidden sm:inline' : ''}`}>{action.label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onNewTransport} className={className} style={style}>
      {content}
    </button>
  );
}

function ProductFocusCard({
  role,
  accent,
  trustScore,
  trustTitle,
  nextSteps,
}: {
  role: DashboardRole;
  accent: string;
  trustScore: number;
  trustTitle: string;
  nextSteps: RoleNextStep[];
}) {
  const roleHeadline: Record<DashboardRole, string> = {
    shipper: 'Erster Transport bis Rechnung',
    carrier: 'Trust Profil + erste DACH Loads',
    driver: 'Heute fahren, POD sichern, Auszahlung sehen',
    dispatcher: 'Touren priorisieren und Ausnahmen klaeren',
    support: 'Vertrauen und Risiken aktiv steuern',
    marketer: 'DACH/Benelux Nische scharf positionieren',
  };

  return (
    <DashboardCard>
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div
          className="rounded-[18px] border p-5"
          style={{
            borderColor: `${accent}32`,
            background: `linear-gradient(135deg, ${accent}16, rgba(255,255,255,0.03))`,
            boxShadow: `0 0 34px ${accent}14`,
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-xl bg-white/[0.06] p-2.5" style={{ color: accent }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-[#2ECC71]/25 bg-[#2ECC71]/10 px-3 py-1 text-xs font-semibold text-[#2ECC71]">
              Trust {trustScore}%
            </span>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">Produktfokus</p>
          <h2 className="mt-2 text-xl font-semibold tracking-normal text-white">{roleHeadline[role]}</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">{trustTitle}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {nextSteps.slice(0, 3).map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className="group rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-white/[0.06]"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityTone(step.priority)}`}>
                  {step.priority === 'high' ? 'Jetzt' : step.priority === 'medium' ? 'Naechst' : 'Optional'}
                </span>
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-[#2ECC71]" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-white" />
                )}
              </div>
              <p className="text-sm font-semibold text-white">{step.label}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">{step.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function priorityTone(priority: RoleNextStep['priority']) {
  switch (priority) {
    case 'high':
      return 'bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20';
    case 'medium':
      return 'bg-[#F39C12]/10 text-[#F39C12] border border-[#F39C12]/20';
    default:
      return 'bg-white/[0.06] text-white/55 border border-white/[0.08]';
  }
}

function QuickActionCard({ data, onNewTransport }: { data: RoleDashboardData; onNewTransport?: () => void }) {
  return (
    <DashboardCard>
      <h3 className="mb-4 font-semibold text-white">Schnellaktionen</h3>
      <div className="space-y-2">
        {data.quickActions.map((action) => {
          const href = actionHref(action, data, onNewTransport);
          const content = (
            <>
              <div
                className="rounded-lg p-2"
                style={{ backgroundColor: `${action.color}20`, color: action.color }}
              >
                {actionIconMap[action.icon]}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-white">{action.label}</p>
                <p className="truncate text-xs text-white/40">{action.detail}</p>
              </div>
            </>
          );

          const className = 'group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 transition-all hover:border-white/[0.12] hover:bg-white/[0.07]';

          return href ? (
            <Link href={href} key={action.label} className={className}>
              {content}
            </Link>
          ) : (
            <button key={action.label} type="button" onClick={onNewTransport} className={className}>
              {content}
            </button>
          );
        })}
      </div>
    </DashboardCard>
  );
}

function RouteControlCard({ data }: { data: RoleDashboardData }) {
  return (
    <DashboardCard className="p-0">
      <div className="flex items-center justify-between border-b border-white/[0.08] p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#1C7ED6]/20 p-2.5 text-[#00D4FF] shadow-lg shadow-[#1C7ED6]/20">
            <Map className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{data.routeTitle}</h3>
            <p className="text-sm text-white/40">Routen, Status und Prioritäten in Echtzeit</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full bg-[#2ECC71]/15 px-3 py-1.5 text-[#2ECC71] sm:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#2ECC71]" />
          <span className="text-xs font-semibold">Live</span>
        </div>
      </div>

      <div className="relative h-[360px] overflow-hidden sm:h-[440px]">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#071927,#06121C)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.8)_1px,transparent_1px)] [background-size:42px_42px]" />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path
            d="M14 22 L25 16 L38 18 L48 14 L62 18 L77 17 L88 28 L91 43 L83 56 L80 72 L65 80 L48 76 L36 86 L22 74 L14 58 L9 45 Z"
            fill="rgba(28,126,214,0.12)"
            stroke="rgba(0,212,255,0.28)"
            strokeWidth="0.45"
          />
          {data.routes.map((route, index) => {
            const from = cityPositions[route.from] || { x: 32, y: 48 };
            const to = cityPositions[route.to] || { x: 68, y: 55 };
            const cx = (from.x + to.x) / 2;
            const cy = Math.min(from.y, to.y) - 16 + index * 5;
            return (
              <g key={`${route.from}-${route.to}-${index}`}>
                <path
                  d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
                  fill="none"
                  stroke="rgba(0,212,255,0.28)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <motion.path
                  d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
                  fill="none"
                  stroke="url(#roleRouteGradient)"
                  strokeWidth="0.75"
                  strokeLinecap="round"
                  strokeDasharray="3 3"
                  animate={{ strokeDashoffset: [0, -24] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', delay: index * 0.2 }}
                />
                <motion.circle
                  r="1.4"
                  fill="#00D4FF"
                  filter="url(#roleGlow)"
                  animate={{
                    offsetDistance: ['0%', '100%'],
                  }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: 'linear', delay: index * 0.55 }}
                  style={{
                    offsetPath: `path("M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}")`,
                  }}
                />
                {[from, to].map((point, pointIndex) => (
                  <g key={`${route.from}-${route.to}-${pointIndex}`}>
                    <circle cx={point.x} cy={point.y} r="3.2" fill="rgba(0,212,255,0.2)" />
                    <circle cx={point.x} cy={point.y} r="1.3" fill={pointIndex === 0 ? '#1C7ED6' : '#2ECC71'} />
                  </g>
                ))}
              </g>
            );
          })}
          <defs>
            <linearGradient id="roleRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1C7ED6" />
              <stop offset="50%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#2ECC71" />
            </linearGradient>
            <filter id="roleGlow">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        <div className="absolute inset-x-4 bottom-4 grid gap-3 md:grid-cols-3">
          {data.routes.slice(0, 3).map((route) => (
            <div key={`${route.from}-${route.to}`} className="rounded-2xl border border-white/[0.08] bg-[#06121C]/78 p-3 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold text-white">{route.from} → {route.to}</p>
                <span className="rounded-full bg-[#00D4FF]/15 px-2 py-0.5 text-xs font-semibold text-[#00D4FF]">
                  {route.progress}%
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-white/45">{route.detail}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF]"
                  initial={{ width: 0 }}
                  animate={{ width: `${route.progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <p className="mt-2 text-xs font-medium text-white/70">{route.value}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function WorkQueueCard({ data }: { data: RoleDashboardData }) {
  return (
    <DashboardCard>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white">{data.workTitle}</h3>
          <p className="text-sm text-white/40">Priorisierte Aufgaben und aktuelle Vorgänge</p>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/55">
          {data.workItems.length} aktiv
        </span>
      </div>
      <div className="space-y-3">
        {data.workItems.map((item, index) => (
          <motion.div
            key={item.title}
            className="group flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:border-white/[0.12] hover:bg-white/[0.06]"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statusToneClass(item.statusTone)}`}>
              <Route className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{item.title}</p>
              <p className="truncate text-xs text-white/45">{item.detail}</p>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-white">{item.meta}</p>
              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusToneClass(item.statusTone)}`}>
                {item.status}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </DashboardCard>
  );
}

function StatusCard({ data }: { data: RoleDashboardData }) {
  return (
    <DashboardCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-white">{data.statusTitle}</h3>
        <Sparkles className="h-4 w-4 text-[#00D4FF]" />
      </div>
      <div className="space-y-3">
        {data.statusItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-3">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${statusToneClass(item.tone).split(' ')[1]}`} />
              <span className="text-sm text-white/70">{item.label}</span>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusToneClass(item.tone)}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function InsightCard({ data }: { data: RoleDashboardData }) {
  return (
    <DashboardCard>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{data.insightTitle}</h3>
          <p className="mt-1 text-sm text-white/40">{data.insightDetail}</p>
        </div>
        <div className="rounded-xl bg-[#00D4FF]/15 p-2 text-[#00D4FF]">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-6 flex items-end justify-between">
        <p className="text-4xl font-bold tracking-tight text-white">{data.insightValue}</p>
        <div className="flex gap-1">
          {[42, 58, 50, 72, 66, 84, 76].map((height, index) => (
            <motion.span
              key={index}
              className="block w-3 rounded-full bg-gradient-to-t from-[#1C7ED6]/20 to-[#00D4FF]"
              initial={{ height: 0 }}
              animate={{ height }}
              transition={{ delay: index * 0.04, duration: 0.5 }}
            />
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function DistributionCard({ data }: { data: RoleDashboardData }) {
  const maxValue = Math.max(...data.distribution.map((item) => item.value));

  return (
    <DashboardCard>
      <h3 className="mb-5 font-semibold text-white">Verteilung</h3>
      <div className="space-y-4">
        {data.distribution.map((item, index) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-white/60">{item.label}</span>
              <span className="text-sm font-medium text-white">{item.value}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${item.color}, ${item.color}88)`,
                  boxShadow: `0 0 18px ${item.color}55`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / maxValue) * 100}%` }}
                transition={{ delay: 0.2 + index * 0.08, duration: 0.8 }}
              />
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function DashboardCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      className={`relative overflow-hidden rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-[0_18px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      whileHover={{ y: -2 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-70" />
      {children}
    </motion.section>
  );
}
