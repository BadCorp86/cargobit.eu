export type DashboardRole =
  | 'shipper'
  | 'carrier'
  | 'driver'
  | 'dispatcher'
  | 'support'
  | 'marketer';

export type RoleMetricColor = 'blue' | 'green' | 'cyan' | 'yellow' | 'red';

export interface RoleDashboardUser {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  companyName?: string;
  role?: string;
  accountType?: string;
  organizationRole?: string;
}

export interface RoleKpi {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  color: RoleMetricColor;
  icon: 'package' | 'route' | 'wallet' | 'users' | 'shield' | 'alert' | 'truck' | 'headphones' | 'target';
  miniChartData: number[];
}

export interface RoleAction {
  label: string;
  detail: string;
  href: string;
  color: string;
  icon: 'plus' | 'user' | 'shield' | 'file' | 'wallet' | 'map' | 'headphones' | 'target';
}

export interface RoleWorkItem {
  title: string;
  detail: string;
  meta: string;
  status: string;
  statusTone: 'success' | 'warning' | 'info' | 'danger';
}

export interface RoleRoute {
  from: string;
  to: string;
  progress: number;
  detail: string;
  value: string;
}

export interface RoleStatusItem {
  label: string;
  value: string;
  tone: 'success' | 'warning' | 'info' | 'danger';
}

export interface RoleDashboardData {
  role: DashboardRole;
  title: string;
  subtitle: string;
  roleLabel: string;
  userName: string;
  companyName?: string;
  primaryAction: RoleAction;
  kpis: RoleKpi[];
  workTitle: string;
  workItems: RoleWorkItem[];
  routeTitle: string;
  routes: RoleRoute[];
  quickActions: RoleAction[];
  statusTitle: string;
  statusItems: RoleStatusItem[];
  insightTitle: string;
  insightValue: string;
  insightDetail: string;
  distribution: Array<{ label: string; value: number; color: string }>;
}

export function normalizeDashboardRole(role?: string | null): DashboardRole {
  switch (role) {
    case 'SHIPPER_PRIVATE':
    case 'SHIPPER_COMPANY':
    case 'shipper':
      return 'shipper';
    case 'CARRIER':
    case 'TRANSPORTER':
    case 'carrier':
      return 'carrier';
    case 'DRIVER_SELF_EMPLOYED':
    case 'driver':
      return 'driver';
    case 'DISPATCHER':
    case 'dispatcher':
      return 'dispatcher';
    case 'SUPPORT':
    case 'support':
      return 'support';
    case 'MARKETER':
    case 'marketer':
      return 'marketer';
    default:
      return 'shipper';
  }
}

function userName(user?: RoleDashboardUser) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return name || user?.email || 'CargoBit User';
}

const commonCharts = {
  up: [36, 44, 48, 52, 58, 63, 61, 68, 72, 78, 83, 88],
  route: [54, 49, 57, 62, 56, 70, 75, 68, 80, 84, 77, 89],
  money: [40, 46, 44, 57, 52, 64, 68, 72, 69, 82, 87, 92],
  down: [82, 76, 73, 68, 62, 58, 51, 48, 43, 39, 34, 30],
  alert: [78, 68, 72, 60, 54, 48, 42, 40, 36, 30, 25, 20],
};

export function getRoleDashboardData(roleInput?: string | null, user?: RoleDashboardUser): RoleDashboardData {
  const role = normalizeDashboardRole(roleInput || user?.role);
  const name = userName(user);

  const base = {
    role,
    userName: name,
    companyName: user?.companyName,
  };

  switch (role) {
    case 'carrier':
      return {
        ...base,
        title: 'Spedition Dashboard',
        subtitle: 'Hauptkonto für Transporteur, Spedition, Flotte und Teamrollen',
        roleLabel: 'Spedition Owner',
        primaryAction: { label: 'Kartenansicht', detail: 'Flotte live prüfen', href: '/carrier/fleet', color: '#1C7ED6', icon: 'map' },
        kpis: [
          { title: 'Verfügbare Loads', value: '24', change: 14.2, changeLabel: '8 priorisiert', color: 'blue', icon: 'package', miniChartData: commonCharts.up },
          { title: 'Fahrzeuge online', value: '12', change: 8.2, changeLabel: '8 unterwegs', color: 'green', icon: 'truck', miniChartData: commonCharts.route },
          { title: 'Aktive Fahrer', value: '15', change: 4.8, changeLabel: '10 verfügbar', color: 'cyan', icon: 'users', miniChartData: commonCharts.up },
          { title: 'Umsatz Monat', value: '45.200 €', change: 12.6, changeLabel: 'vs. letzter Monat', color: 'yellow', icon: 'wallet', miniChartData: commonCharts.money },
        ],
        workTitle: 'Verfügbare Aufträge',
        workItems: [
          { title: 'Hamburg → Barcelona', detail: '1.850 km • Paletten • Direktfahrt', meta: '1.680 €', status: 'Sofort', statusTone: 'success' },
          { title: 'Berlin → Mailand', detail: '1.200 km • Stückgut • Express', meta: '1.250 €', status: 'Morgen', statusTone: 'warning' },
          { title: 'München → Paris', detail: '830 km • Komplettladung', meta: '980 €', status: '48h', statusTone: 'info' },
        ],
        routeTitle: 'Flottenkarte',
        routes: [
          { from: 'Hamburg', to: 'Barcelona', progress: 38, detail: 'Truck-04 • 14 Paletten', value: '1.680 €' },
          { from: 'Berlin', to: 'Mailand', progress: 62, detail: 'Truck-09 • Express', value: '1.250 €' },
          { from: 'München', to: 'Paris', progress: 21, detail: 'Truck-02 • verfügbar', value: '980 €' },
        ],
        quickActions: [
          { label: 'Disposition öffnen', detail: 'Touren und KI-Matching', href: '/dashboard?role=dispatcher', color: '#00D4FF', icon: 'target' },
          { label: 'Fahrer zuweisen', detail: 'Kapazität optimieren', href: '/carrier/drivers', color: '#1C7ED6', icon: 'user' },
          { label: 'Angebot abgeben', detail: 'Load sichern', href: '/carrier/loads', color: '#2ECC71', icon: 'plus' },
          { label: 'Payouts prüfen', detail: 'Wallet und Abrechnung', href: '/carrier/wallet', color: '#F39C12', icon: 'wallet' },
        ],
        statusTitle: 'Flottenstatus',
        statusItems: [
          { label: 'Verfügbar', value: '5 Fahrzeuge', tone: 'success' },
          { label: 'Unterwegs', value: '8 Fahrzeuge', tone: 'info' },
          { label: 'Pause', value: '2 Fahrer', tone: 'warning' },
          { label: 'Wartung', value: '1 Fahrzeug', tone: 'danger' },
        ],
        insightTitle: 'KI-Auslastung',
        insightValue: '87%',
        insightDetail: 'Empfohlene Tourbündelung spart ca. 6,8% Leerfahrten.',
        distribution: [
          { label: 'Sprinter', value: 34, color: '#1C7ED6' },
          { label: 'Koffer', value: 28, color: '#00D4FF' },
          { label: 'Plane', value: 23, color: '#2ECC71' },
          { label: 'Kühlung', value: 15, color: '#F39C12' },
        ],
      };
    case 'driver':
      return {
        ...base,
        title: 'Solo-Transporteur Dashboard',
        subtitle: 'Für selbstständige Fahrer und kleine Gewerbetreibende im Transport',
        roleLabel: 'Selbstständiger Transporteur',
        primaryAction: { label: 'Mobile Tour öffnen', detail: 'Status und POD senden', href: '/driver/mobile', color: '#2ECC71', icon: 'shield' },
        kpis: [
          { title: 'Verdienst verfügbar', value: '3.420 €', change: 9.1, changeLabel: '8 Touren diese Woche', color: 'green', icon: 'wallet', miniChartData: commonCharts.money },
          { title: 'Aktuelle Tour', value: 'HH → MUC', change: 65, changeLabel: '65% abgeschlossen', color: 'blue', icon: 'route', miniChartData: commonCharts.route },
          { title: 'Bewertung', value: '4.9', change: 2.2, changeLabel: '342 Touren', color: 'yellow', icon: 'shield', miniChartData: commonCharts.up },
          { title: 'Pünktlichkeit', value: '98%', change: 3.4, changeLabel: 'letzte 30 Tage', color: 'cyan', icon: 'truck', miniChartData: commonCharts.up },
        ],
        workTitle: 'Aktueller Auftrag',
        workItems: [
          { title: 'Beladung Hamburg Hafenstraße 42', detail: '8 Paletten • CMR erforderlich', meta: 'Jetzt', status: 'Aktiv', statusTone: 'success' },
          { title: 'Nächster Halt: Raststätte Allertal', detail: 'ETA 42 Min. • Pause empfohlen', meta: 'A7', status: 'Empfohlen', statusTone: 'info' },
          { title: 'Entladung München Nord', detail: 'Zeitfenster 18:00 - 19:30', meta: '850 €', status: 'Geplant', statusTone: 'warning' },
        ],
        routeTitle: 'Live Navigation',
        routes: [
          { from: 'Hamburg', to: 'München', progress: 65, detail: 'Aktueller Auftrag #TR-4829', value: '850 €' },
          { from: 'München', to: 'Mailand', progress: 0, detail: 'Optionaler Folgeauftrag', value: '1.120 €' },
        ],
        quickActions: [
          { label: 'Mobile Tour', detail: 'Status und POD senden', href: '/driver/mobile', color: '#2ECC71', icon: 'shield' },
          { label: 'Dokument hochladen', detail: 'CMR / Lieferschein', href: '/driver/documents', color: '#1C7ED6', icon: 'file' },
          { label: 'Support kontaktieren', detail: '24/7 Hilfe', href: '/driver/support', color: '#F39C12', icon: 'headphones' },
        ],
        statusTitle: 'Tourstatus',
        statusItems: [
          { label: 'Auftrag angenommen', value: '08:30', tone: 'success' },
          { label: 'Beladung', value: 'Jetzt', tone: 'info' },
          { label: 'Transport', value: 'als nächstes', tone: 'warning' },
          { label: 'Entladung', value: '18:00', tone: 'info' },
        ],
        insightTitle: 'Fahrer Score',
        insightValue: '98%',
        insightDetail: 'Sehr hohe Pünktlichkeit und niedrige Stornoquote.',
        distribution: [
          { label: 'Touren', value: 42, color: '#1C7ED6' },
          { label: 'Pünktlich', value: 38, color: '#2ECC71' },
          { label: 'Dokumente', value: 31, color: '#00D4FF' },
          { label: 'Support', value: 3, color: '#F39C12' },
        ],
      };
    case 'dispatcher':
      return {
        ...base,
        title: 'Spedition Disposition',
        subtitle: 'Unterrolle der Spedition für Matching, Tourplanung und KI-Entscheidungen',
        roleLabel: 'Disposition',
        primaryAction: { label: 'Tour planen', detail: 'KI-Vorschlag nutzen', href: '/carrier/dispatch/suggestions', color: '#00D4FF', icon: 'target' },
        kpis: [
          { title: 'Matching Score', value: '81%', change: 11.4, changeLabel: 'Top Vorschlag', color: 'cyan', icon: 'target', miniChartData: commonCharts.up },
          { title: 'Heutige Touren', value: '18', change: 6.3, changeLabel: '12 offen', color: 'blue', icon: 'route', miniChartData: commonCharts.route },
          { title: 'Kapazität', value: '87%', change: 8.8, changeLabel: 'Flotte ausgelastet', color: 'green', icon: 'truck', miniChartData: commonCharts.up },
          { title: 'Risiko Alerts', value: '3', change: -12, changeLabel: '2 gelöst', color: 'red', icon: 'alert', miniChartData: commonCharts.alert },
        ],
        workTitle: 'KI Matching Vorschläge',
        workItems: [
          { title: 'Tour Hamburg-Hafen MO-03', detail: 'Baustoffe nach Bremen • +312 € • CO2 -6,8 kg', meta: 'Score 81', status: 'Empfohlen', statusTone: 'success' },
          { title: 'Tour Hamburg-Nord MO-01', detail: '5 Paletten nach Kiel • +187 € • 12 km Umweg', meta: 'Score 72', status: 'Prüfen', statusTone: 'info' },
          { title: 'Express Medizintechnik Lübeck', detail: 'Service-Level hoch • Risiko mittel', meta: 'Score 58', status: 'Manuell', statusTone: 'warning' },
        ],
        routeTitle: 'Dispatch Control Map',
        routes: [
          { from: 'Hamburg', to: 'Bremen', progress: 81, detail: 'Tour-Hafen MO-03', value: '+312 €' },
          { from: 'Hamburg', to: 'Kiel', progress: 72, detail: 'Tour-Nord MO-01', value: '+187 €' },
          { from: 'Hamburg', to: 'Lübeck', progress: 58, detail: 'Express MedTech', value: '+245 €' },
        ],
        quickActions: [
          { label: 'Vorschlag annehmen', detail: 'Tour optimieren', href: '/api/dispatcher/suggestions', color: '#2ECC71', icon: 'shield' },
          { label: 'Simulation starten', detail: 'Scoring neu berechnen', href: '/api/dispatcher/simulate', color: '#00D4FF', icon: 'target' },
          { label: 'Regeln prüfen', detail: 'Matching Profil der Spedition', href: '/ml', color: '#F39C12', icon: 'file' },
        ],
        statusTitle: 'Operations Status',
        statusItems: [
          { label: 'ML Scoring', value: 'Canary aktiv', tone: 'info' },
          { label: 'Heuristik', value: 'Online', tone: 'success' },
          { label: 'SLA Warnungen', value: '3 offen', tone: 'warning' },
          { label: 'Zuweisungen', value: '12 aktiv', tone: 'success' },
        ],
        insightTitle: 'SHAP Erklärung',
        insightValue: '+31.5',
        insightDetail: 'Revenue und Kapazitätsauslastung treiben den Top-Vorschlag.',
        distribution: [
          { label: 'Revenue', value: 35, color: '#1C7ED6' },
          { label: 'Kapazität', value: 20, color: '#00D4FF' },
          { label: 'SLA', value: 15, color: '#2ECC71' },
          { label: 'CO2', value: 10, color: '#F39C12' },
        ],
      };
    case 'support':
      return {
        ...base,
        title: 'Support Dashboard',
        subtitle: 'Tickets, Streitfälle und KI-Assistenz',
        roleLabel: 'Support',
        primaryAction: { label: 'Live Chat öffnen', detail: 'Priorisierte Warteschlange', href: '/support/tickets', color: '#1C7ED6', icon: 'headphones' },
        kpis: [
          { title: 'Offene Tickets', value: '23', change: -7.8, changeLabel: '6 kritisch', color: 'red', icon: 'headphones', miniChartData: commonCharts.alert },
          { title: 'In Bearbeitung', value: '15', change: 4.2, changeLabel: 'Team aktiv', color: 'yellow', icon: 'users', miniChartData: commonCharts.route },
          { title: 'Heute gelöst', value: '42', change: 18.4, changeLabel: 'SLA 96%', color: 'green', icon: 'shield', miniChartData: commonCharts.up },
          { title: 'Antwortzeit', value: '8 Min', change: -12, changeLabel: 'schneller als Ziel', color: 'cyan', icon: 'target', miniChartData: commonCharts.down },
        ],
        workTitle: 'Priorisierte Tickets',
        workItems: [
          { title: '#892 Streitfall Transport #4518', detail: 'Schaden an Ladung • Müller GmbH', meta: 'vor 5 Min.', status: 'Kritisch', statusTone: 'danger' },
          { title: '#891 Rückerstattung angefordert', detail: 'Stornierung nach Annahme', meta: 'vor 12 Min.', status: 'Mittel', statusTone: 'warning' },
          { title: '#890 Verifizierung fehlgeschlagen', detail: 'Dokumente unklar', meta: 'vor 25 Min.', status: 'Niedrig', statusTone: 'info' },
        ],
        routeTitle: 'Incident Map',
        routes: [
          { from: 'Berlin', to: 'München', progress: 46, detail: 'Streitfall #892', value: 'hoch' },
          { from: 'Hamburg', to: 'Köln', progress: 88, detail: 'Rückerstattung #891', value: 'mittel' },
        ],
        quickActions: [
          { label: 'Ticket übernehmen', detail: 'Nächstes SLA', href: '/support/tickets', color: '#1C7ED6', icon: 'headphones' },
          { label: 'Streitfall öffnen', detail: 'Refund prüfen', href: '/admin/disputes', color: '#E74C3C', icon: 'shield' },
          { label: 'KI-Antwort', detail: 'Antwortvorschlag', href: '/support/ai', color: '#00D4FF', icon: 'target' },
        ],
        statusTitle: 'SLA Status',
        statusItems: [
          { label: 'Kritisch', value: '6 Tickets', tone: 'danger' },
          { label: 'SLA erfüllt', value: '96%', tone: 'success' },
          { label: 'KI gelöst', value: '68%', tone: 'info' },
          { label: 'Eskalationen', value: '4', tone: 'warning' },
        ],
        insightTitle: 'KI Assist',
        insightValue: '68%',
        insightDetail: 'Automatisch gelöste Standardanfragen im heutigen Volumen.',
        distribution: [
          { label: 'Disputes', value: 28, color: '#E74C3C' },
          { label: 'Refunds', value: 22, color: '#F39C12' },
          { label: 'KYC', value: 30, color: '#1C7ED6' },
          { label: 'Chat', value: 20, color: '#00D4FF' },
        ],
      };
    case 'marketer':
      return {
        ...base,
        title: 'Marketing Dashboard',
        subtitle: 'Kampagnen, Partner und Conversion-Funnel',
        roleLabel: 'Marketing',
        primaryAction: { label: 'Kampagne starten', detail: 'Neue Zielgruppe', href: '/marketer/campaigns', color: '#00D4FF', icon: 'target' },
        kpis: [
          { title: 'Aktive Kampagnen', value: '12', change: 18.2, changeLabel: '4 neue Segmente', color: 'blue', icon: 'target', miniChartData: commonCharts.up },
          { title: 'Leads Monat', value: '4.280', change: 24.6, changeLabel: 'vs. letzter Monat', color: 'green', icon: 'users', miniChartData: commonCharts.up },
          { title: 'Conversion', value: '8.7%', change: 3.1, changeLabel: 'Landing Pages', color: 'cyan', icon: 'route', miniChartData: commonCharts.route },
          { title: 'CAC', value: '42 €', change: -9.5, changeLabel: 'effizienter', color: 'yellow', icon: 'wallet', miniChartData: commonCharts.down },
        ],
        workTitle: 'Kampagnen Performance',
        workItems: [
          { title: 'Transporteur Growth DACH', detail: '1.420 Leads • 9.8% CVR', meta: 'ROAS 4.2', status: 'Stark', statusTone: 'success' },
          { title: 'Shipper SME EU', detail: '2.180 Leads • 7.4% CVR', meta: 'ROAS 3.1', status: 'Aktiv', statusTone: 'info' },
          { title: 'Spedition Enterprise', detail: '680 Leads • 12.1% CVR', meta: 'ROAS 5.0', status: 'Top', statusTone: 'success' },
        ],
        routeTitle: 'Growth Map',
        routes: [
          { from: 'Hamburg', to: 'Paris', progress: 72, detail: 'SME Shipper Segment', value: '2.180' },
          { from: 'Warschau', to: 'München', progress: 48, detail: 'Transporteur Growth', value: '1.420' },
          { from: 'Mailand', to: 'Barcelona', progress: 64, detail: 'Spedition Enterprise', value: '680' },
        ],
        quickActions: [
          { label: 'Audience bauen', detail: 'Segment prüfen', href: '/marketer/partners', color: '#1C7ED6', icon: 'user' },
          { label: 'Report exportieren', detail: 'Performance', href: '/marketer/analytics', color: '#00D4FF', icon: 'file' },
          { label: 'Budget optimieren', detail: 'CAC senken', href: '/marketer/campaigns', color: '#F39C12', icon: 'wallet' },
        ],
        statusTitle: 'Funnel Status',
        statusItems: [
          { label: 'Awareness', value: '72%', tone: 'info' },
          { label: 'Activation', value: '8.7%', tone: 'success' },
          { label: 'CAC', value: '42 €', tone: 'warning' },
          { label: 'ROAS', value: '4.2', tone: 'success' },
        ],
        insightTitle: 'Growth AI',
        insightValue: '+24.6%',
        insightDetail: 'Lead-Qualität steigt im Transporteur-Segment DACH.',
        distribution: [
          { label: 'Shipper', value: 46, color: '#1C7ED6' },
          { label: 'Transporteure', value: 31, color: '#2ECC71' },
          { label: 'Driver', value: 14, color: '#F39C12' },
          { label: 'Enterprise', value: 9, color: '#00D4FF' },
        ],
      };
    case 'shipper':
    default:
      const isPrivateShipper = user?.role === 'SHIPPER_PRIVATE';
      return {
        ...base,
        title: isPrivateShipper ? 'Privater Verlader Dashboard' : 'Gewerbeverlader Dashboard',
        subtitle: isPrivateShipper
          ? 'Einzeltransporte, Angebote, Zahlung und Dokumente'
          : 'Firmentransporte, Angebote, Kostenkontrolle und Verifizierung',
        roleLabel: isPrivateShipper ? 'Privater Verlader' : 'Gewerblicher Verlader',
        primaryAction: { label: 'Transport erstellen', detail: 'Neue Sendung anlegen', href: '/shipper/new', color: '#1C7ED6', icon: 'plus' },
        kpis: [
          { title: 'Aktive Transporte', value: '3', change: 12.5, changeLabel: '2 heute unterwegs', color: 'blue', icon: 'route', miniChartData: commonCharts.route },
          { title: 'Offene Angebote', value: '7', change: 8.2, changeLabel: '3 neue Gebote', color: 'yellow', icon: 'package', miniChartData: commonCharts.up },
          { title: 'Monatsausgaben', value: '18.750 €', change: -4.3, changeLabel: 'unter Budget', color: 'green', icon: 'wallet', miniChartData: commonCharts.down },
          { title: 'Erfolgsrate', value: '96%', change: 5.4, changeLabel: 'pünktliche Lieferungen', color: 'cyan', icon: 'shield', miniChartData: commonCharts.up },
        ],
        workTitle: 'Meine Transporte',
        workItems: [
          { title: 'Hamburg → München', detail: '8 Paletten • Schnell Transport GmbH', meta: '850 €', status: 'Unterwegs', statusTone: 'success' },
          { title: 'Berlin → Köln', detail: '3 Angebote eingegangen • Stückgut', meta: 'ab 420 €', status: 'Angebote', statusTone: 'warning' },
          { title: 'Frankfurt → Stuttgart', detail: 'Kühltransport abgeschlossen', meta: '550 €', status: 'Erledigt', statusTone: 'info' },
        ],
        routeTitle: 'Live Tracking',
        routes: [
          { from: 'Hamburg', to: 'München', progress: 65, detail: 'Aktiver Transport #TR-4829', value: 'ETA 18:40' },
          { from: 'Berlin', to: 'Köln', progress: 12, detail: 'Angebotsphase', value: '3 Gebote' },
          { from: 'Frankfurt', to: 'Stuttgart', progress: 100, detail: 'Abgeschlossen', value: '550 €' },
        ],
        quickActions: [
          { label: 'Neuen Transport', detail: 'Auftrag erstellen', href: '/shipper/new', color: '#1C7ED6', icon: 'plus' },
          { label: 'Wallet aufladen', detail: 'Guthaben sichern', href: '/shipper/wallet', color: '#2ECC71', icon: 'wallet' },
          { label: 'Dokumente', detail: 'CMR und Rechnungen', href: '/shipper/documents', color: '#00D4FF', icon: 'file' },
        ],
        statusTitle: 'Transportstatus',
        statusItems: [
          { label: 'Unterwegs', value: '3', tone: 'success' },
          { label: 'Angebote', value: '7', tone: 'warning' },
          { label: 'Abgeschlossen', value: '24', tone: 'info' },
          { label: 'Support', value: '1 offen', tone: 'danger' },
        ],
        insightTitle: 'KI-Preisempfehlung',
        insightValue: '1.680 €',
        insightDetail: '+10% höhere Erfolgswahrscheinlichkeit für Hamburg → München.',
        distribution: [
          { label: 'Express', value: 31, color: '#1C7ED6' },
          { label: 'Standard', value: 42, color: '#2ECC71' },
          { label: 'Kühlung', value: 16, color: '#00D4FF' },
          { label: 'Gefahrgut', value: 11, color: '#F39C12' },
        ],
      };
  }
}
