import { prisma } from '@/lib/db';
import {
  DashboardRole,
  RoleDashboardData,
  RoleDashboardUser,
  RoleKpi,
  RoleRoute,
  RoleStatusItem,
  RoleWorkItem,
  getRoleDashboardData,
  normalizeDashboardRole,
} from '@/lib/role-dashboard-data';

type DashboardDataSource = 'database' | 'fallback';

export interface ConnectedRoleDashboardResult {
  data: RoleDashboardData;
  source: DashboardDataSource;
  connectedServices: string[];
  warning?: string;
}

interface DashboardContext {
  role: DashboardRole;
  user?: RoleDashboardUser;
  fallback: RoleDashboardData;
  dbUser?: any;
  company?: any;
  driver?: any;
}

const ACTIVE_TRANSPORT_STATUSES = ['CREATED', 'PUBLISHED', 'ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'];
const MOVING_TRANSPORT_STATUSES = ['ASSIGNED', 'IN_TRANSIT', 'PICKUP_DONE', 'DELIVERY_DONE'];
const OPEN_TRANSPORT_STATUSES = ['CREATED', 'PUBLISHED'];
const ACTIVE_MATCHING_STATUSES = ['STARTED', 'RUNNING'];
const OPEN_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS'];
const palette = ['#1C7ED6', '#00D4FF', '#2ECC71', '#F39C12', '#E74C3C'];

const compactCurrency = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('de-DE', {
  maximumFractionDigits: 0,
});

export async function getConnectedRoleDashboardData(
  roleInput?: string | null,
  user?: RoleDashboardUser,
): Promise<ConnectedRoleDashboardResult> {
  const role = normalizeDashboardRole(roleInput || user?.role);
  const fallback = getRoleDashboardData(role, user);

  try {
    const context = await resolveDashboardContext(role, user, fallback);

    switch (context.role) {
      case 'carrier':
        return await buildCarrierDashboard(context);
      case 'driver':
        return await buildDriverDashboard(context);
      case 'dispatcher':
        return await buildDispatcherDashboard(context);
      case 'support':
        return await buildSupportDashboard(context);
      case 'marketer':
        return await buildMarketerDashboard(context);
      case 'shipper':
      default:
        return await buildShipperDashboard(context);
    }
  } catch (error) {
    console.error('[RoleDashboard] Falling back to static dashboard data:', error);
    return {
      data: fallback,
      source: 'fallback',
      connectedServices: ['fallback'],
      warning: 'Database dashboard aggregation failed',
    };
  }
}

async function resolveDashboardContext(
  role: DashboardRole,
  user: RoleDashboardUser | undefined,
  fallback: RoleDashboardData,
): Promise<DashboardContext> {
  const userId = user?.id?.trim();
  const email = user?.email?.trim();

  const userInclude = {
    wallet: true,
    driver: true,
    companyUsers: {
      include: {
        company: {
          include: {
            wallets: true,
          },
        },
      },
      take: 1,
    },
  };

  const dbUser = userId
    ? await prisma.user.findUnique({ where: { id: userId }, include: userInclude })
    : email
      ? await prisma.user.findUnique({ where: { email }, include: userInclude })
      : null;

  const companyFromUser = dbUser?.companyUsers?.[0]?.company;
  const companyFromName = !companyFromUser && user?.companyName
    ? await prisma.company.findFirst({
        where: { name: { contains: user.companyName } },
        include: { wallets: true },
      })
    : null;

  const driver = dbUser?.driver || (role === 'driver'
    ? await prisma.driver.findFirst({
        include: { user: true, company: true },
        orderBy: { updatedAt: 'desc' },
      })
    : null);

  return {
    role,
    user,
    fallback,
    dbUser,
    company: companyFromUser || companyFromName,
    driver,
  };
}

async function buildShipperDashboard(context: DashboardContext): Promise<ConnectedRoleDashboardResult> {
  const userId = context.dbUser?.id;
  const transportWhere: any = userId ? { shipperUserId: userId } : {};
  const monthlyWhere: any = { ...transportWhere, status: 'COMPLETED', createdAt: { gte: monthStart() } };
  const offerWhere: any = { status: 'PENDING' };
  if (userId) offerWhere.transport = { shipperUserId: userId };

  const [
    transports,
    activeCount,
    movingCount,
    completedCount,
    totalCount,
    pendingOfferCount,
    monthlySpend,
    supportOpenCount,
    typeGroups,
  ] = await Promise.all([
    prisma.transport.findMany({
      where: transportWhere,
      include: transportInclude,
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.transport.count({ where: { ...transportWhere, status: { in: ACTIVE_TRANSPORT_STATUSES as any } } }),
    prisma.transport.count({ where: { ...transportWhere, status: { in: MOVING_TRANSPORT_STATUSES as any } } }),
    prisma.transport.count({ where: { ...transportWhere, status: 'COMPLETED' } }),
    prisma.transport.count({ where: transportWhere }),
    prisma.offer.count({ where: offerWhere }),
    prisma.transport.aggregate({ where: monthlyWhere, _sum: { agreedPrice: true } }),
    prisma.supportTicket.count({
      where: userId
        ? { userId, status: { in: OPEN_TICKET_STATUSES as any } }
        : { status: { in: OPEN_TICKET_STATUSES as any } },
    }),
    prisma.transport.groupBy({
      by: ['transportType'],
      where: transportWhere,
      _count: { _all: true },
      orderBy: { _count: { transportType: 'desc' } },
      take: 4,
    }),
  ]);

  const successRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const data = overlayDashboard(context.fallback, {
    userName: displayName(context),
    companyName: context.company?.name || context.fallback.companyName,
    kpis: [
      patchKpi(context.fallback.kpis[0], String(activeCount), `${movingCount} unterwegs`),
      patchKpi(context.fallback.kpis[1], String(pendingOfferCount), `${Math.min(pendingOfferCount, 3)} neue Gebote`),
      patchKpi(context.fallback.kpis[2], formatCurrency(monthlySpend._sum.agreedPrice), 'aktueller Monat'),
      patchKpi(context.fallback.kpis[3], `${successRate}%`, `${completedCount} abgeschlossen`),
    ],
    workItems: preferReal(transports.map(transportToWorkItem), context.fallback.workItems),
    routes: preferReal(transports.slice(0, 4).map(transportToRoute), context.fallback.routes),
    statusItems: [
      { label: 'Unterwegs', value: String(movingCount), tone: movingCount ? 'success' : 'info' },
      { label: 'Angebote', value: String(pendingOfferCount), tone: pendingOfferCount ? 'warning' : 'success' },
      { label: 'Abgeschlossen', value: String(completedCount), tone: 'info' },
      { label: 'Support', value: `${supportOpenCount} offen`, tone: supportOpenCount ? 'danger' : 'success' },
    ],
    insightValue: formatCurrency(averageTransportValue(transports)),
    insightDetail: 'Durchschnittlicher Auftragswert aus echten Transport- und Jobdaten.',
    distribution: preferReal(groupDistribution(typeGroups, 'transportType'), context.fallback.distribution),
  });

  return result(data, ['jobs', 'transports', 'offers', 'wallet', 'support']);
}

async function buildCarrierDashboard(context: DashboardContext): Promise<ConnectedRoleDashboardResult> {
  const companyId = context.company?.id;
  const driverWhere: any = companyId ? { companyId } : {};
  const vehicleWhere: any = companyId ? { companyId } : {};
  const revenueWhere: any = { status: 'ACCEPTED', createdAt: { gte: monthStart() } };
  if (companyId) revenueWhere.driver = { companyId };

  const activeAssignmentWhere: any = { status: { in: MOVING_TRANSPORT_STATUSES as any } };
  if (companyId) {
    activeAssignmentWhere.assignment = { is: { driver: { companyId } } };
  } else {
    activeAssignmentWhere.assignment = { isNot: null };
  }

  const [
    openLoads,
    openLoadCount,
    activeVehicles,
    vehicleCount,
    availableDrivers,
    driverCount,
    revenue,
    activeRoutes,
    vehicleGroups,
  ] = await Promise.all([
    prisma.transport.findMany({
      where: { status: { in: OPEN_TRANSPORT_STATUSES as any } },
      include: transportInclude,
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.transport.count({ where: { status: { in: OPEN_TRANSPORT_STATUSES as any } } }),
    prisma.vehicle.count({ where: { ...vehicleWhere, status: 'ACTIVE' } }),
    prisma.vehicle.count({ where: vehicleWhere }),
    prisma.driver.count({ where: { ...driverWhere, isAvailable: true } }),
    prisma.driver.count({ where: driverWhere }),
    prisma.offer.aggregate({ where: revenueWhere, _sum: { price: true } }),
    prisma.transport.findMany({
      where: activeAssignmentWhere,
      include: transportInclude,
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    prisma.vehicle.groupBy({
      by: ['type'],
      where: vehicleWhere,
      _count: { _all: true },
      orderBy: { _count: { type: 'desc' } },
      take: 4,
    }),
  ]);

  const utilisation = vehicleCount > 0 ? Math.round(((vehicleCount - Math.max(activeVehicles - availableDrivers, 0)) / vehicleCount) * 100) : 0;
  const data = overlayDashboard(context.fallback, {
    userName: displayName(context),
    companyName: context.company?.name || context.fallback.companyName,
    kpis: [
      patchKpi(context.fallback.kpis[0], String(openLoadCount), `${openLoads.length} sofort sichtbar`),
      patchKpi(context.fallback.kpis[1], String(activeVehicles), `${vehicleCount} gesamt`),
      patchKpi(context.fallback.kpis[2], String(driverCount), `${availableDrivers} verfügbar`),
      patchKpi(context.fallback.kpis[3], formatCurrency(revenue._sum.price), 'angenommene Angebote'),
    ],
    workItems: preferReal(openLoads.map(loadToCarrierWorkItem), context.fallback.workItems),
    routes: preferReal((activeRoutes.length ? activeRoutes : openLoads).slice(0, 4).map(transportToRoute), context.fallback.routes),
    statusItems: [
      { label: 'Verfügbar', value: `${availableDrivers} Fahrer`, tone: availableDrivers ? 'success' : 'warning' },
      { label: 'Fahrzeuge aktiv', value: `${activeVehicles}`, tone: activeVehicles ? 'info' : 'warning' },
      { label: 'Auslastung', value: `${utilisation}%`, tone: utilisation > 80 ? 'success' : 'info' },
      { label: 'Wartung', value: `${Math.max(vehicleCount - activeVehicles, 0)} Fahrzeuge`, tone: vehicleCount > activeVehicles ? 'warning' : 'success' },
    ],
    insightValue: `${utilisation}%`,
    insightDetail: 'Auslastung aus echten Fahrer-, Fahrzeug- und Assignmentdaten.',
    distribution: preferReal(groupDistribution(vehicleGroups, 'type'), context.fallback.distribution),
  });

  return result(data, ['jobs', 'transports', 'fleet', 'drivers', 'offers', 'wallet']);
}

async function buildDriverDashboard(context: DashboardContext): Promise<ConnectedRoleDashboardResult> {
  const driver = context.driver;
  const driverId = driver?.id;
  const userId = context.dbUser?.id || driver?.userId;

  if (!driverId) {
    return result(context.fallback, ['fallback']);
  }

  const [
    assignments,
    activeAssignmentCount,
    pendingOffers,
    monthlyRevenue,
    wallet,
    supportOpenCount,
  ] = await Promise.all([
    prisma.assignment.findMany({
      where: { driverId },
      include: {
        vehicle: true,
        transport: {
          include: transportInclude,
        },
      },
      orderBy: { assignedAt: 'desc' },
      take: 5,
    }),
    prisma.assignment.count({
      where: {
        driverId,
        transport: { status: { in: MOVING_TRANSPORT_STATUSES as any } },
      },
    }),
    prisma.offer.count({ where: { driverId, status: 'PENDING' } }),
    prisma.offer.aggregate({
      where: { driverId, status: 'ACCEPTED', createdAt: { gte: monthStart() } },
      _sum: { price: true },
    }),
    userId ? prisma.wallet.findFirst({ where: { ownerUserId: userId } }) : Promise.resolve(null),
    userId
      ? prisma.supportTicket.count({ where: { userId, status: { in: OPEN_TICKET_STATUSES as any } } })
      : Promise.resolve(0),
  ]);

  const currentAssignment = assignments.find((assignment: any) => MOVING_TRANSPORT_STATUSES.includes(assignment.transport.status))
    || assignments[0];
  const currentRoute = currentAssignment?.transport ? transportToRoute(currentAssignment.transport) : null;
  const rating = driver.ratingAvg ? driver.ratingAvg.toFixed(1) : '0.0';

  const data = overlayDashboard(context.fallback, {
    userName: displayName(context),
    companyName: context.company?.name || driver.company?.name || context.fallback.companyName,
    kpis: [
      patchKpi(context.fallback.kpis[0], formatCurrency(wallet?.balance ?? monthlyRevenue._sum.price), `${driver.completedTransports || assignments.length} Touren`),
      patchKpi(context.fallback.kpis[1], currentRoute ? `${shortCity(currentRoute.from)} → ${shortCity(currentRoute.to)}` : 'Keine', `${currentRoute?.progress ?? 0}% abgeschlossen`),
      patchKpi(context.fallback.kpis[2], rating, `${driver.ratingCount || 0} Bewertungen`),
      patchKpi(context.fallback.kpis[3], String(pendingOffers), 'offene Angebote'),
    ],
    workItems: preferReal(assignments.map(assignmentToDriverWorkItem), context.fallback.workItems),
    routes: preferReal(assignments.map((assignment: any) => transportToRoute(assignment.transport)), context.fallback.routes),
    statusItems: [
      { label: 'Aktiv', value: String(activeAssignmentCount), tone: activeAssignmentCount ? 'success' : 'info' },
      { label: 'Angebote', value: String(pendingOffers), tone: pendingOffers ? 'warning' : 'success' },
      { label: 'Support', value: `${supportOpenCount} offen`, tone: supportOpenCount ? 'danger' : 'success' },
      { label: 'Verfügbar', value: driver.isAvailable ? 'Ja' : 'Nein', tone: driver.isAvailable ? 'success' : 'warning' },
    ],
    insightValue: `${Math.round((driver.ratingAvg || 0) * 20)}%`,
    insightDetail: 'Fahrer-Score aus Bewertung, Verfügbarkeit und abgeschlossenen Transporten.',
    distribution: [
      { label: 'Abgeschlossen', value: driver.completedTransports || 0, color: '#2ECC71' },
      { label: 'Aktiv', value: activeAssignmentCount, color: '#1C7ED6' },
      { label: 'Angebote', value: pendingOffers, color: '#F39C12' },
      { label: 'Support', value: supportOpenCount, color: '#E74C3C' },
    ],
  });

  return result(data, ['jobs', 'transports', 'driver', 'wallet', 'offers']);
}

async function buildDispatcherDashboard(context: DashboardContext): Promise<ConnectedRoleDashboardResult> {
  const day = dayWindow();

  const [
    topCandidates,
    runningSessions,
    todayTours,
    activeAssignments,
    riskAlerts,
    avgScore,
  ] = await Promise.all([
    prisma.matchingCandidate.findMany({
      include: {
        matchingSession: {
          include: {
            transport: {
              include: transportInclude,
            },
          },
        },
        driver: {
          include: {
            user: true,
            company: true,
          },
        },
        vehicle: true,
      },
      orderBy: { score: 'desc' },
      take: 6,
    }),
    prisma.matchingSession.count({ where: { status: { in: ACTIVE_MATCHING_STATUSES as any } } }),
    prisma.transport.count({ where: { pickupDatetime: { gte: day.start, lt: day.end } } }),
    prisma.assignment.count({ where: { transport: { status: { in: MOVING_TRANSPORT_STATUSES as any } } } }),
    prisma.securityFlag.count({ where: { active: true, severity: { in: ['HIGH', 'CRITICAL'] as any } } }),
    prisma.matchingCandidate.aggregate({ _avg: { score: true } }),
  ]);

  const matchingScore = Math.round(avgScore._avg.score || topCandidates[0]?.score || 0);
  const candidateTransports = topCandidates
    .map((candidate: any) => candidate.matchingSession?.transport)
    .filter(Boolean);

  const data = overlayDashboard(context.fallback, {
    userName: displayName(context),
    companyName: context.company?.name || context.fallback.companyName,
    kpis: [
      patchKpi(context.fallback.kpis[0], `${matchingScore}%`, `${topCandidates.length} Kandidaten`),
      patchKpi(context.fallback.kpis[1], String(todayTours), `${runningSessions} Matchings aktiv`),
      patchKpi(context.fallback.kpis[2], `${capacityScore(activeAssignments, todayTours)}%`, `${activeAssignments} Zuweisungen`),
      patchKpi(context.fallback.kpis[3], String(riskAlerts), 'aktive Security Flags'),
    ],
    workItems: preferReal(topCandidates.map(candidateToDispatcherWorkItem), context.fallback.workItems),
    routes: preferReal(candidateTransports.slice(0, 4).map(transportToRoute), context.fallback.routes),
    statusItems: [
      { label: 'ML Scoring', value: runningSessions ? 'Aktiv' : 'Bereit', tone: runningSessions ? 'info' : 'success' },
      { label: 'Matching', value: `${runningSessions} Sessions`, tone: runningSessions ? 'success' : 'info' },
      { label: 'Risiko Alerts', value: String(riskAlerts), tone: riskAlerts ? 'warning' : 'success' },
      { label: 'Zuweisungen', value: `${activeAssignments} aktiv`, tone: activeAssignments ? 'success' : 'info' },
    ],
    insightValue: `${matchingScore}%`,
    insightDetail: 'Durchschnittlicher Matching-Score aus echten Matching-Candidates.',
    distribution: [
      { label: 'Score', value: matchingScore, color: '#00D4FF' },
      { label: 'Touren', value: todayTours, color: '#1C7ED6' },
      { label: 'Assignments', value: activeAssignments, color: '#2ECC71' },
      { label: 'Risiko', value: riskAlerts, color: '#F39C12' },
    ],
  });

  return result(data, ['dispatcher', 'matching', 'jobs', 'transports', 'security']);
}

async function buildSupportDashboard(context: DashboardContext): Promise<ConnectedRoleDashboardResult> {
  const [
    tickets,
    openTickets,
    inProgressTickets,
    resolvedToday,
    urgentTickets,
    productFeedbackOpen,
    categoryGroups,
  ] = await Promise.all([
    prisma.supportTicket.findMany({
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.supportTicket.count({ where: { status: 'RESOLVED', resolvedAt: { gte: dayWindow().start } } }),
    prisma.supportTicket.count({ where: { priority: { in: ['HIGH', 'URGENT'] }, status: { in: OPEN_TICKET_STATUSES as any } } }),
    prisma.supportTicket.count({ where: { category: 'PRODUCT_FEEDBACK', status: { in: OPEN_TICKET_STATUSES as any } } }),
    prisma.supportTicket.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
      take: 4,
    }),
  ]);

  const data = overlayDashboard(context.fallback, {
    userName: displayName(context),
    kpis: [
      patchKpi(context.fallback.kpis[0], String(openTickets), `${urgentTickets} kritisch`),
      patchKpi(context.fallback.kpis[1], String(inProgressTickets), 'Team aktiv'),
      patchKpi(context.fallback.kpis[2], String(resolvedToday), 'heute gelöst'),
      patchKpi(context.fallback.kpis[3], openTickets ? `${Math.max(4, 14 - openTickets)} Min` : '4 Min', 'SLA Schätzung'),
    ],
    workItems: preferReal(tickets.map(ticketToWorkItem), context.fallback.workItems),
    statusItems: [
      { label: 'Kritisch', value: `${urgentTickets} Tickets`, tone: urgentTickets ? 'danger' : 'success' },
      { label: 'Offen', value: String(openTickets), tone: openTickets ? 'warning' : 'success' },
      { label: 'In Bearbeitung', value: String(inProgressTickets), tone: inProgressTickets ? 'info' : 'success' },
      { label: 'Produkt-Feedback', value: String(productFeedbackOpen), tone: productFeedbackOpen ? 'info' : 'success' },
      { label: 'Heute gelöst', value: String(resolvedToday), tone: 'success' },
    ],
    insightValue: `${resolvedToday}`,
    insightDetail: 'Heute gelöste Tickets aus dem echten Support-Backend.',
    distribution: preferReal(groupDistribution(categoryGroups, 'category', 'Allgemein'), context.fallback.distribution),
  });

  return result(data, ['support', 'tickets', 'users']);
}

async function buildMarketerDashboard(context: DashboardContext): Promise<ConnectedRoleDashboardResult> {
  const campaignWhere: any = context.dbUser?.id ? { userId: context.dbUser.id } : {};

  const [
    campaigns,
    activeCampaigns,
    campaignBudget,
    statusGroups,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: campaignWhere,
      include: { stats: true },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    prisma.campaign.count({ where: { ...campaignWhere, status: 'ACTIVE' } }),
    prisma.campaign.aggregate({ where: campaignWhere, _sum: { budget: true, spentAmount: true } }),
    prisma.campaign.groupBy({
      by: ['status'],
      where: campaignWhere,
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
      take: 4,
    }),
  ]);

  const stats = campaigns.flatMap((campaign: any) => campaign.stats || []);
  const impressions = stats.reduce((sum: number, stat: any) => sum + stat.impressions, 0);
  const clicks = stats.reduce((sum: number, stat: any) => sum + stat.clicks, 0);
  const conversions = stats.reduce((sum: number, stat: any) => sum + stat.conversions, 0);
  const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : '0.0';
  const cac = conversions > 0 ? (campaignBudget._sum.spentAmount || 0) / conversions : 0;

  const data = overlayDashboard(context.fallback, {
    userName: displayName(context),
    companyName: context.company?.name || context.fallback.companyName,
    kpis: [
      patchKpi(context.fallback.kpis[0], String(activeCampaigns), `${campaigns.length} gesamt`),
      patchKpi(context.fallback.kpis[1], formatNumber(conversions), `${formatNumber(clicks)} Klicks`),
      patchKpi(context.fallback.kpis[2], `${conversionRate}%`, `${formatNumber(impressions)} Impressions`),
      patchKpi(context.fallback.kpis[3], formatCurrency(cac), 'echter CAC'),
    ],
    workItems: preferReal(campaigns.map(campaignToWorkItem), context.fallback.workItems),
    statusItems: [
      { label: 'Aktiv', value: String(activeCampaigns), tone: activeCampaigns ? 'success' : 'info' },
      { label: 'Budget', value: formatCurrency(campaignBudget._sum.budget), tone: 'info' },
      { label: 'Spend', value: formatCurrency(campaignBudget._sum.spentAmount), tone: 'warning' },
      { label: 'Conversions', value: String(conversions), tone: conversions ? 'success' : 'info' },
    ],
    insightValue: `${conversionRate}%`,
    insightDetail: 'Conversion Rate aus echten Kampagnen-Statistiken.',
    distribution: preferReal(groupDistribution(statusGroups, 'status'), context.fallback.distribution),
  });

  return result(data, ['campaigns', 'campaign-stats', 'wallet']);
}

const transportInclude = {
  pickupAddress: true,
  deliveryAddress: true,
  transportDetail: true,
  offers: true,
  assignment: {
    include: {
      driver: {
        include: {
          user: true,
        },
      },
      vehicle: true,
    },
  },
};

function result(data: RoleDashboardData, connectedServices: string[]): ConnectedRoleDashboardResult {
  return {
    data,
    source: connectedServices.includes('fallback') ? 'fallback' : 'database',
    connectedServices,
  };
}

function overlayDashboard(fallback: RoleDashboardData, updates: Partial<RoleDashboardData>): RoleDashboardData {
  return {
    ...fallback,
    ...updates,
    kpis: preferReal(updates.kpis, fallback.kpis),
    workItems: preferReal(updates.workItems, fallback.workItems),
    routes: preferReal(updates.routes, fallback.routes),
    quickActions: preferReal(updates.quickActions, fallback.quickActions),
    statusItems: preferReal(updates.statusItems, fallback.statusItems),
    distribution: preferReal(updates.distribution, fallback.distribution),
  };
}

function preferReal<T>(real: T[] | undefined, fallback: T[]): T[] {
  return real && real.length > 0 ? real : fallback;
}

function patchKpi(base: RoleKpi, value: string, changeLabel: string, change = base.change): RoleKpi {
  return {
    ...base,
    value,
    change,
    changeLabel,
  };
}

function formatCurrency(value?: number | null): string {
  return compactCurrency.format(value || 0).replace(/\s/g, ' ');
}

function formatNumber(value?: number | null): string {
  return numberFormatter.format(value || 0);
}

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function dayWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function displayName(context: DashboardContext): string {
  const dbName = [context.dbUser?.firstName, context.dbUser?.lastName].filter(Boolean).join(' ').trim();
  const inputName = [context.user?.firstName, context.user?.lastName].filter(Boolean).join(' ').trim();
  return dbName || inputName || context.user?.email || context.fallback.userName;
}

function routeLabel(transport: any): string {
  return `${cityLabel(transport.pickupAddress)} → ${cityLabel(transport.deliveryAddress)}`;
}

function cityLabel(address?: any): string {
  return address?.city || address?.country || 'Europa';
}

function shortCity(city: string): string {
  const map: Record<string, string> = {
    Hamburg: 'HH',
    München: 'MUC',
    Munich: 'MUC',
    Berlin: 'BER',
    Paris: 'PAR',
    Mailand: 'MIL',
    Milan: 'MIL',
    Barcelona: 'BCN',
    Warschau: 'WAW',
    Warsaw: 'WAW',
    Köln: 'CGN',
    Frankfurt: 'FRA',
    Stuttgart: 'STR',
  };
  return map[city] || city.slice(0, 3).toUpperCase();
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    CREATED: 'Erstellt',
    PUBLISHED: 'Angebote',
    ASSIGNED: 'Zugewiesen',
    IN_TRANSIT: 'Unterwegs',
    PICKUP_DONE: 'Abgeholt',
    DELIVERY_DONE: 'Geliefert',
    COMPLETED: 'Erledigt',
    CANCELLED: 'Storniert',
  };
  return map[status] || status;
}

function statusTone(status: string): RoleWorkItem['statusTone'] {
  if (status === 'COMPLETED') return 'info';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'CREATED' || status === 'PUBLISHED') return 'warning';
  return 'success';
}

function progressForStatus(status: string): number {
  const map: Record<string, number> = {
    CREATED: 8,
    PUBLISHED: 18,
    ASSIGNED: 38,
    IN_TRANSIT: 64,
    PICKUP_DONE: 78,
    DELIVERY_DONE: 92,
    COMPLETED: 100,
    CANCELLED: 0,
  };
  return map[status] ?? 12;
}

function transportToWorkItem(transport: any): RoleWorkItem {
  const offers = transport.offers?.length || 0;
  const price = transport.agreedPrice || transport.shipperBudget;
  return {
    title: routeLabel(transport),
    detail: [transport.description, offers ? `${offers} Angebote` : undefined, transport.transportType].filter(Boolean).join(' • '),
    meta: price ? formatCurrency(price) : timeAgo(transport.createdAt),
    status: statusLabel(transport.status),
    statusTone: statusTone(transport.status),
  };
}

function loadToCarrierWorkItem(transport: any): RoleWorkItem {
  return {
    title: routeLabel(transport),
    detail: [distanceLabel(transport), transport.description || transport.transportType, transport.transportDetail?.weightKg ? `${transport.transportDetail.weightKg} kg` : undefined].filter(Boolean).join(' • '),
    meta: formatCurrency(transport.shipperBudget || transport.agreedPrice),
    status: transport.pickupDatetime ? dateLabel(transport.pickupDatetime) : 'Offen',
    statusTone: transport.pickupDatetime && new Date(transport.pickupDatetime) < new Date(Date.now() + 24 * 60 * 60 * 1000) ? 'success' : 'info',
  };
}

function assignmentToDriverWorkItem(assignment: any): RoleWorkItem {
  const transport = assignment.transport;
  return {
    title: routeLabel(transport),
    detail: [assignment.vehicle?.plateNumber, transport.description || transport.transportType, distanceLabel(transport)].filter(Boolean).join(' • '),
    meta: formatCurrency(transport.agreedPrice || transport.shipperBudget),
    status: statusLabel(transport.status),
    statusTone: statusTone(transport.status),
  };
}

function candidateToDispatcherWorkItem(candidate: any): RoleWorkItem {
  const transport = candidate.matchingSession?.transport;
  const driverName = [candidate.driver?.user?.firstName, candidate.driver?.user?.lastName].filter(Boolean).join(' ').trim();
  return {
    title: transport ? routeLabel(transport) : `Matching ${candidate.id.slice(-6)}`,
    detail: [driverName || candidate.driver?.company?.name, candidate.vehicle?.plateNumber, candidate.hardFilterPassed ? 'Hard Filter ok' : 'Filter prüfen'].filter(Boolean).join(' • '),
    meta: `Score ${Math.round(candidate.score || 0)}`,
    status: candidate.status === 'ACCEPTED' ? 'Angenommen' : candidate.status === 'REJECTED' ? 'Abgelehnt' : 'Empfohlen',
    statusTone: candidate.status === 'REJECTED' ? 'danger' : candidate.score >= 70 ? 'success' : 'warning',
  };
}

function ticketToWorkItem(ticket: any): RoleWorkItem {
  return {
    title: ticket.subject,
    detail: [ticket.user?.email, ticket.category || 'Support', ticket.priority].filter(Boolean).join(' • '),
    meta: timeAgo(ticket.updatedAt),
    status: ticket.status === 'IN_PROGRESS' ? 'In Arbeit' : ticket.status === 'RESOLVED' ? 'Gelöst' : ticket.status,
    statusTone: ticket.priority === 'URGENT' || ticket.priority === 'HIGH' ? 'danger' : ticket.status === 'RESOLVED' ? 'success' : 'warning',
  };
}

function campaignToWorkItem(campaign: any): RoleWorkItem {
  const clicks = (campaign.stats || []).reduce((sum: number, stat: any) => sum + stat.clicks, 0);
  const conversions = (campaign.stats || []).reduce((sum: number, stat: any) => sum + stat.conversions, 0);
  return {
    title: campaign.name,
    detail: [campaign.position || 'Kampagne', `${clicks} Klicks`, `${conversions} Conversions`].join(' • '),
    meta: formatCurrency(campaign.spentAmount),
    status: campaign.status,
    statusTone: campaign.status === 'ACTIVE' ? 'success' : campaign.status === 'PAUSED' ? 'warning' : 'info',
  };
}

function transportToRoute(transport: any): RoleRoute {
  const price = transport.agreedPrice || transport.shipperBudget;
  return {
    from: cityLabel(transport.pickupAddress),
    to: cityLabel(transport.deliveryAddress),
    progress: progressForStatus(transport.status),
    detail: [transport.description || transport.transportType, statusLabel(transport.status)].filter(Boolean).join(' • '),
    value: price ? formatCurrency(price) : statusLabel(transport.status),
  };
}

function averageTransportValue(transports: any[]): number {
  const values = transports
    .map((transport) => transport.agreedPrice || transport.shipperBudget || 0)
    .filter(Boolean);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function distanceLabel(transport: any): string | undefined {
  return transport.distanceKm ? `${Math.round(transport.distanceKm)} km` : undefined;
}

function dateLabel(date: Date | string): string {
  const value = new Date(date);
  const now = new Date();
  const diffDays = Math.round((value.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'Heute';
  if (diffDays === 1) return 'Morgen';
  return `${diffDays} Tage`;
}

function timeAgo(date?: Date | string): string {
  if (!date) return 'gerade';
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return `vor ${Math.round(hours / 24)} Tg.`;
}

function groupDistribution(groups: any[], key: string, fallbackLabel = 'Sonstige') {
  const total = groups.reduce((sum, group) => sum + (group._count?._all || 0), 0);
  return groups.map((group, index) => ({
    label: String(group[key] || fallbackLabel),
    value: total > 0 ? Math.max(1, Math.round(((group._count?._all || 0) / total) * 100)) : 0,
    color: palette[index % palette.length],
  }));
}

function capacityScore(activeAssignments: number, todayTours: number): number {
  if (!todayTours) return activeAssignments ? 100 : 0;
  return Math.min(100, Math.round((activeAssignments / todayTours) * 100));
}
