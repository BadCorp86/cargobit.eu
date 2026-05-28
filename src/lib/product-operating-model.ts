export type ProductRole =
  | 'shipper'
  | 'carrier'
  | 'driver'
  | 'dispatcher'
  | 'support'
  | 'marketer';

export type TrustSignalStatus = 'verified' | 'pending' | 'missing' | 'warning';
export type LifecycleStatus = 'done' | 'active' | 'next' | 'blocked' | 'waiting';

export interface TrustSignal {
  id: string;
  label: string;
  detail: string;
  status: TrustSignalStatus;
  owner: 'CargoBit' | 'Nutzer' | 'Partner' | 'System';
}

export interface TrustProfile {
  score: number;
  level: 'starter' | 'trusted' | 'premium' | 'restricted';
  title: string;
  summary: string;
  signals: TrustSignal[];
  requiredNextSteps: string[];
}

export interface LifecycleStage {
  id: string;
  label: string;
  owner: 'Verlader' | 'Transporteur' | 'Fahrer' | 'CargoBit' | 'System';
  status: LifecycleStatus;
  description: string;
  automation: string;
  cta: string;
  endpoint?: string;
}

export interface RoleNextStep {
  id: string;
  label: string;
  detail: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  done?: boolean;
}

export interface NicheMarketLane {
  id: string;
  label: string;
  region: 'DACH' | 'Benelux' | 'Cross-border';
  cargo: string;
  promise: string;
  fitScore: number;
}

export const nicheMarketLanes: NicheMarketLane[] = [
  {
    id: 'dach-paletten-express',
    label: 'DACH Paletten & Express',
    region: 'DACH',
    cargo: '1-12 Paletten, Same-Day/Next-Day',
    promise: 'Schnelle Angebote fuer kleine Gewerbe, Handel und Ersatzteile.',
    fitScore: 94,
  },
  {
    id: 'de-benelux-ltl',
    label: 'Deutschland ↔ Benelux LTL',
    region: 'Benelux',
    cargo: 'Teilladungen, Stueckgut, planbare Pendel',
    promise: 'Hohe Nachfrage, kurze Distanzen, gute Wiederholbarkeit.',
    fitScore: 89,
  },
  {
    id: 'dach-solo-transport',
    label: 'Solo-Transporteure bis 3,5t',
    region: 'DACH',
    cargo: 'Sprinter, Koffer, lokale Gewerbefahrten',
    promise: 'Niedrige Einstiegshuerde fuer Kleingewerbe und transparente Verifikation.',
    fitScore: 91,
  },
  {
    id: 'de-at-ch-regional',
    label: 'DE/AT/CH regionale Speditionen',
    region: 'Cross-border',
    cargo: 'Paletten, Maschinen, B2B-Regelverkehr',
    promise: 'Verifizierte Profile, dokumentierte Ablieferung und klare Abrechnung.',
    fitScore: 87,
  },
];

export const lifecycleBlueprint: LifecycleStage[] = [
  {
    id: 'order_created',
    label: 'Auftrag erstellen',
    owner: 'Verlader',
    status: 'done',
    description: 'Route, Fracht, Zeitfenster, Budget und Anforderungen werden strukturiert erfasst.',
    automation: 'KI-Preisempfehlung, Pflichtfelder, Risiko-Precheck',
    cta: 'Auftrag vervollstaendigen',
    endpoint: '/api/jobs',
  },
  {
    id: 'matching',
    label: 'Matching',
    owner: 'System',
    status: 'active',
    description: 'Passende Fahrer, Fahrzeuge und Speditionen werden nach Region, Kapazitaet und Trust Score sortiert.',
    automation: 'Matching Score, Fraud Check, Lizenz-/Versicherungsregeln',
    cta: 'Matches ansehen',
    endpoint: '/api/matching/start',
  },
  {
    id: 'offer',
    label: 'Angebot & Annahme',
    owner: 'Verlader',
    status: 'next',
    description: 'Verlader vergleicht Preis, Bewertung, Dokumente und Verfuegbarkeit.',
    automation: 'Wallet-Reservierung, Fee Quote, Audit Trail',
    cta: 'Bestes Angebot pruefen',
    endpoint: '/api/bids',
  },
  {
    id: 'execution',
    label: 'Transportstatus',
    owner: 'Fahrer',
    status: 'waiting',
    description: 'Abholung, Unterwegs, Lieferung und Ereignisse werden mobil gefuehrt.',
    automation: 'Status-Timeline, ETA, GPS-Punkte, Benachrichtigungen',
    cta: 'Fahreransicht oeffnen',
    endpoint: '/driver/mobile',
  },
  {
    id: 'pod',
    label: 'POD / eCMR',
    owner: 'Fahrer',
    status: 'waiting',
    description: 'Abliefernachweis mit Foto, Signatur, PDF oder digitaler Bestaetigung.',
    automation: 'POD Upload, Plausibilitaetscheck, manuelle Verifikation',
    cta: 'POD erfassen',
    endpoint: '/api/executions/[id]/pod',
  },
  {
    id: 'invoice',
    label: 'Rechnung',
    owner: 'System',
    status: 'waiting',
    description: 'Transportpreis, CargoBit-Gebuehren, Wallet-Gebuehr und MwSt. werden separat ausgewiesen.',
    automation: 'Automatische Rechnungsdaten, PDF/Email vorbereitet',
    cta: 'Rechnungsdaten pruefen',
    endpoint: '/api/subscriptions',
  },
  {
    id: 'payout',
    label: 'Auszahlung',
    owner: 'CargoBit',
    status: 'waiting',
    description: 'Freigabe nach erledigtem Transport, POD-Pruefung und Risk Gate.',
    automation: 'Wallet, Payout Delay, Stripe Connect/Bankauszahlung',
    cta: 'Payout Status',
    endpoint: '/api/wallet/payout',
  },
];

export const roleNextSteps: Record<ProductRole, RoleNextStep[]> = {
  shipper: [
    { id: 'create_order', label: 'Transportauftrag erstellen', detail: 'Route, Fracht, Zeitfenster und Budget festlegen.', href: '/#auftrag', priority: 'high' },
    { id: 'fund_wallet', label: 'Wallet/Absicherung vorbereiten', detail: 'Zahlung fuer Angebote reservieren und Rechnung vorbereiten.', href: '/shipper/wallet', priority: 'high' },
    { id: 'verify_profile', label: 'Profil verifizieren', detail: 'Privat KYC oder Firmen-KYB abschliessen.', href: '/preview', priority: 'medium' },
  ],
  carrier: [
    { id: 'complete_trust', label: 'Trust Profil abschliessen', detail: 'Gewerbeschein, Transportlizenz und Versicherung pruefen lassen.', href: '/dashboard?role=carrier', priority: 'high' },
    { id: 'fleet_ready', label: 'Fahrzeuge und Fahrer freigeben', detail: 'Kapazitaeten, Fahrzeugtypen und Verfuegbarkeit pflegen.', href: '/carrier/fleet', priority: 'high' },
    { id: 'bid_dach', label: 'DACH Loads anbieten', detail: 'Mit Paletten/Express-Lanes starten und Bewertungen aufbauen.', href: '/carrier/loads', priority: 'medium' },
  ],
  driver: [
    { id: 'open_mobile', label: 'Mobile Fahreransicht oeffnen', detail: 'Naechsten Stop, Status und POD direkt am Smartphone fuehren.', href: '/driver/mobile', priority: 'high' },
    { id: 'upload_docs', label: 'Dokumente vervollstaendigen', detail: 'Fuehrerschein, Fahrerkarte, Versicherung und ADR falls noetig.', href: '/driver/documents', priority: 'high' },
    { id: 'earnings', label: 'Verdienst und Auszahlung pruefen', detail: 'Offene Touren, reservierte Zahlungen und Payout Status.', href: '/driver/earnings', priority: 'medium' },
  ],
  dispatcher: [
    { id: 'dispatch_queue', label: 'Touren priorisieren', detail: 'KI-Vorschlaege nach Marge, Risiko und Verfuegbarkeit sortieren.', href: '/dashboard?role=dispatcher', priority: 'high' },
    { id: 'assign_driver', label: 'Fahrer zuweisen', detail: 'Lizenz, Fahrzeug, Ruhezeit und Entfernung pruefen.', href: '/carrier/drivers', priority: 'high' },
    { id: 'monitor_exceptions', label: 'Ausnahmen bearbeiten', detail: 'Verspaetung, Dokumente, Support und Re-Routing.', href: '/support/tickets', priority: 'medium' },
  ],
  support: [
    { id: 'verify_queue', label: 'Verifizierungen bearbeiten', detail: 'OCR/VIES/Tickets pruefen und Trust Profile freigeben.', href: '/admin/verifications', priority: 'high' },
    { id: 'risk_cases', label: 'Risk Cases pruefen', detail: 'Missbrauch, Fake-Carrier und Zahlungsrisiken priorisieren.', href: '/admin/disputes', priority: 'high' },
    { id: 'manual_review', label: 'Manuelle Kontrolle dokumentieren', detail: 'Entscheidung mit Audit-Trail und Nutzerinfo speichern.', href: '/support/tickets', priority: 'medium' },
  ],
  marketer: [
    { id: 'niche_launch', label: 'DACH/Benelux Launch fokussieren', detail: 'Paletten, Express und Solo-Transporteure als erste Kampagne.', href: '/preview', priority: 'high' },
    { id: 'trust_message', label: 'Trust-Versprechen testen', detail: 'Verifiziert, bezahlt abgesichert, digital dokumentiert.', href: '/marketer/campaigns', priority: 'medium' },
    { id: 'partner_pipeline', label: 'Versicherungs-Partner gewinnen', detail: 'CMR/Frachtversicherung als Add-on vermarkten.', href: '/partner', priority: 'medium' },
  ],
};

export function normalizeProductRole(role?: string | null): ProductRole {
  switch ((role || '').toUpperCase()) {
    case 'CARRIER':
    case 'TRANSPORTER':
    case 'SPEDITION':
      return 'carrier';
    case 'DRIVER':
    case 'DRIVER_SELF_EMPLOYED':
      return 'driver';
    case 'DISPATCHER':
      return 'dispatcher';
    case 'SUPPORT':
      return 'support';
    case 'MARKETER':
      return 'marketer';
    case 'SHIPPER_COMPANY':
    case 'SHIPPER_PRIVATE':
    case 'SHIPPER':
    default:
      return 'shipper';
  }
}

export function getRoleNextSteps(role?: string | null): RoleNextStep[] {
  return roleNextSteps[normalizeProductRole(role)];
}

export function getFallbackTrustProfile(role?: string | null): TrustProfile {
  const normalizedRole = normalizeProductRole(role);
  const businessRole = normalizedRole === 'carrier' || normalizedRole === 'driver' || normalizedRole === 'dispatcher';

  return {
    score: businessRole ? 82 : 76,
    level: businessRole ? 'trusted' : 'starter',
    title: businessRole ? 'Verifiziertes Transportprofil' : 'Abgesicherter Auftraggeber',
    summary: businessRole
      ? 'Profil ist fuer DACH/Benelux-Loads geeignet, Versicherung und Lizenz sollten regelmaessig erneuert werden.'
      : 'Auftraggeber ist startklar, Wallet-Reservierung und Profiltransparenz erhoehen die Angebotsqualitaet.',
    signals: [
      {
        id: 'identity',
        label: businessRole ? 'KYC/KYB abgeschlossen' : 'Identitaet geprueft',
        detail: businessRole ? 'OCR, VIES und manuelle Kontrolle verfuegbar.' : 'Basis-Identitaet fuer sichere Auftragsvergabe.',
        status: 'verified',
        owner: 'CargoBit',
      },
      {
        id: 'insurance',
        label: 'Versicherung',
        detail: businessRole ? 'CMR/Frachtversicherung pruefen und Ablaufdatum ueberwachen.' : 'Optionaler Schutz wird beim Auftrag angeboten.',
        status: businessRole ? 'pending' : 'verified',
        owner: 'Partner',
      },
      {
        id: 'license',
        label: 'Lizenz / Fahrerlaubnis',
        detail: businessRole ? 'Fuehrerschein, Transportlizenz und ADR je nach Auftrag.' : 'Nur passende Anbieter duerfen bieten.',
        status: businessRole ? 'pending' : 'verified',
        owner: 'Nutzer',
      },
      {
        id: 'rating',
        label: 'Bewertungen',
        detail: 'Sichtbarer Score aus puenktlichen Lieferungen, Stornoquote und Reviews.',
        status: 'verified',
        owner: 'System',
      },
      {
        id: 'payment_protection',
        label: 'Zahlungsabsicherung',
        detail: 'Wallet-/Escrow-Logik mit Risk Gate vor Auszahlung.',
        status: 'verified',
        owner: 'CargoBit',
      },
    ],
    requiredNextSteps: businessRole
      ? ['Versicherung mit Ablaufdatum hinterlegen', 'Fahrzeug/Fahrer fuer erste DACH-Lane freigeben']
      : ['Wallet fuer ersten Auftrag vorbereiten', 'Transparente Rechnungsdaten vervollstaendigen'],
  };
}

export function getFallbackDriverMission() {
  return {
    id: 'mission_demo_hh_muc',
    title: 'Hamburg → Muenchen',
    subtitle: '8 Paletten · Zeitfenster 18:00-19:30',
    status: 'IN_TRANSIT',
    payout: '850 EUR',
    progress: 65,
    nextStop: {
      label: 'Muenchen Messe',
      eta: '42 Min.',
      action: 'Lieferung bestaetigen',
    },
    checklist: [
      { id: 'pickup', label: 'Beladung bestaetigt', done: true },
      { id: 'cmr', label: 'CMR/Frachtbrief hochgeladen', done: true },
      { id: 'location', label: 'Live-Standort aktiv', done: true },
      { id: 'delivery', label: 'Entladung bestaetigen', done: false },
      { id: 'pod', label: 'POD Foto/Signatur erfassen', done: false },
    ],
    actions: [
      { label: 'Status senden', href: '/api/executions/demo/status' },
      { label: 'POD hochladen', href: '/api/executions/demo/pod' },
      { label: 'Support', href: '/support/tickets' },
    ],
  };
}

export function buildLifecycleFromTransport(status?: string | null): LifecycleStage[] {
  const normalizedStatus = (status || 'PUBLISHED').toUpperCase();
  const stageOrder = ['order_created', 'matching', 'offer', 'execution', 'pod', 'invoice', 'payout'];
  const activeIndexByStatus: Record<string, number> = {
    CREATED: 0,
    PUBLISHED: 1,
    ASSIGNED: 2,
    IN_TRANSIT: 3,
    PICKUP_DONE: 3,
    DELIVERY_DONE: 4,
    COMPLETED: 6,
    CANCELLED: 0,
  };
  const activeIndex = activeIndexByStatus[normalizedStatus] ?? 1;

  return lifecycleBlueprint.map((stage, index) => ({
    ...stage,
    status: normalizedStatus === 'CANCELLED'
      ? index === activeIndex ? 'blocked' : 'waiting'
      : index < activeIndex
        ? 'done'
        : index === activeIndex
          ? 'active'
          : index === activeIndex + 1
            ? 'next'
            : 'waiting',
  }));
}

export function getPlatformOperatingModel(role?: string | null) {
  return {
    trustProfile: getFallbackTrustProfile(role),
    lifecycle: buildLifecycleFromTransport('PUBLISHED'),
    nextSteps: getRoleNextSteps(role),
    nicheMarketLanes,
    driverMission: getFallbackDriverMission(),
  };
}
