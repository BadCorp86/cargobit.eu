'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast, Toaster } from 'sonner';
import {
  Truck,
  Package,
  Globe,
  Shield,
  Users,
  Star,
  ArrowRight,
  ChevronDown,
  Menu,
  X,
  MapPin,
  Clock,
  BarChart3,
  FileText,
  HeadphonesIcon,
  Check,
  Play,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Loader2,
  Calculator,
  MessageSquare,
  Send,
  Lightbulb,
} from 'lucide-react';

import { buildUserRequestHeaders, useAuthStore } from '@/lib/auth-store';
import { AuthModal } from '@/components/auth/auth-modal';
import { Dashboard } from '@/components/dashboard/dashboard';
import { TransportForm, type TransportFormInitialData, type TransportFormSubmitPayload } from '@/components/transport/transport-form';
import { PartnerPortal } from '@/components/partner/partner-portal';
import { TransporteurOnboarding } from '@/components/onboarding/transporteur-onboarding';
import { ShipperOnboarding } from '@/components/onboarding/shipper-onboarding';
import { getSubscriptionPlanConfig } from '@/lib/billing/plans';
import {
  CARGO_TYPE_CONFIGS,
  CARGO_TYPE_LABELS,
  CONTAINER_VOLUME_M3,
  LIQUID_UNIT_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  getCargoTypeConfig,
  type CargoTransportType,
} from '@/lib/cargo-types';

const PUBLIC_PRICING_PLANS = getSubscriptionPlanConfig();
const PUBLIC_PRICING_ORDER = ['free', 'starter'] as const;
const PUBLIC_PLAN_DESCRIPTIONS: Record<(typeof PUBLIC_PRICING_ORDER)[number], string> = {
  free: 'Für private Einzelaufträge, Tests und gelegentliche Frachtanfragen ohne Grundgebühr.',
  starter: 'Für kleine Gewerbe, regelmäßige Verlader, Transporteure und Speditionen mit planbarem Volumen.',
};

type QuickQuoteForm = {
  pickupCity: string;
  deliveryCity: string;
  transportType: CargoTransportType;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  bulkMaterial: string;
  bulkVolumeM3: string;
  bulkDensityKgM3: string;
  liquidProduct: string;
  liquidAmount: string;
  liquidAmountUnit: 'liter' | 'm3';
  liquidContainerType: string;
  vehicleSubtype: string;
  vehicleLengthM: string;
  vehicleWidthM: string;
  vehicleHeightM: string;
  vehicleWeightKg: string;
  vehicleCount: string;
  vehicleCondition: string;
  containerType: string;
  cargoValueEur: string;
};

type QuickQuoteResult = {
  recommendedPrice: number;
  marketPrice: number;
  minPrice: number;
  currency: string;
  confidence: number;
  source: string;
  route: {
    distanceKm: number;
    durationMinutes: number;
    tollCost: number;
  };
};

const SPECIAL_TRANSPORT_LABELS = CARGO_TYPE_LABELS;

const FEEDBACK_CATEGORIES = [
  'Funktion fehlt',
  'Bedienbarkeit',
  'Preis & Zahlungsschutz',
  'Transportprozess',
  'Verifizierung',
  'Sonstiges',
] as const;

type FeedbackForm = {
  category: (typeof FEEDBACK_CATEGORIES)[number];
  roleContext: string;
  message: string;
  pageUrl: string;
};

const SEO_FAQS = [
  {
    question: 'Was kostet ein Transport?',
    answer:
      'Der Preis hängt von Strecke, Gewicht, Volumen, Frachtart, Maut, Fahrzeit, Risiko und Sonderanforderungen ab. CargoBit berechnet eine realistische KI-Preisempfehlung als Orientierung vor dem Auftrag.',
  },
  {
    question: 'Kann ich Sondergut transportieren lassen?',
    answer:
      'Ja. CargoBit unterstützt Anfragen für Gefahrgut, Kühltransporte, Übergröße, Fahrzeugtransporte, Container und Tieflader. Je nach Fracht können Nachweise, Versicherungen oder Spezialfahrzeuge erforderlich sein.',
  },
  {
    question: 'Können Speditionen den KI-Preis unterbieten?',
    answer:
      'Transporteure und Speditionen können Angebote abgeben und den empfohlenen Preis unterbieten, solange das Angebot plausibel bleibt und nicht unter die Anti-Dumping- beziehungsweise Mindestpreislogik fällt.',
  },
  {
    question: 'Wie funktioniert der Zahlungsschutz?',
    answer:
      'Der Verlader bereitet die Zahlung für einen konkreten Auftrag vor. CargoBit reserviert den Betrag auftragsbezogen. Nach Lieferung, POD/eCMR und Risikoprüfung wird die Auszahlung an den Transporteur freigegeben.',
  },
  {
    question: 'Wann wird ein Auftrag veröffentlicht?',
    answer:
      'Ein Auftrag wird veröffentlicht, wenn die wichtigsten Frachtdaten, der KI-Preis beziehungsweise das Budget und die notwendige Zahlungsreservierung vorliegen.',
  },
  {
    question: 'Wie werden Transporteure geprüft?',
    answer:
      'CargoBit kombiniert Profil-, Dokumenten-, Versicherungs- und Trust-Signale. Je nach Rolle und Land können Gewerbenachweise, Lizenzen, Versicherungen und weitere Unterlagen erforderlich sein.',
  },
];

const STRUCTURED_DATA = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CargoBit',
    url: 'https://cargobit.eu',
    logo: 'https://cargobit.eu/images/dashboard-main.png',
    description:
      'CargoBit ist eine digitale Transportplattform für Verlader, Transporteure, Fahrer und Speditionen im DACH- und EU-Markt.',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'CargoBit',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: 'https://cargobit.eu',
    description:
      'Digitale Logistikplattform mit KI-Preisrechner, Transportauftrag, Zahlungsschutz, Verifizierung, Versicherung und Angebotsprozess.',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: '0',
      description: 'Kostenloser Einstieg mit Provision oder Business-Tarif für 89 EUR netto pro Monat.',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: SEO_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  },
];

function formatCurrency(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value || 0);
}

export default function Home() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [showPartnerPortal, setShowPartnerPortal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showShipperOnboarding, setShowShipperOnboarding] = useState(false);
  const [quickQuoteForm, setQuickQuoteForm] = useState<QuickQuoteForm>({
    pickupCity: 'Hamburg',
    deliveryCity: 'München',
    transportType: 'pallet',
    weightKg: '500',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    bulkMaterial: '',
    bulkVolumeM3: '',
    bulkDensityKgM3: '',
    liquidProduct: '',
    liquidAmount: '',
    liquidAmountUnit: 'liter',
    liquidContainerType: 'ibc',
    vehicleSubtype: 'suv',
    vehicleLengthM: '',
    vehicleWidthM: '',
    vehicleHeightM: '',
    vehicleWeightKg: '',
    vehicleCount: '1',
    vehicleCondition: 'fahrbereit',
    containerType: '40ft',
    cargoValueEur: '',
  });
  const [quickQuoteResult, setQuickQuoteResult] = useState<QuickQuoteResult | null>(null);
  const [quickQuoteLoading, setQuickQuoteLoading] = useState(false);
  const [quickQuoteError, setQuickQuoteError] = useState<string | null>(null);
  const [pendingTransportData, setPendingTransportData] = useState<TransportFormInitialData | null>(null);
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm>({
    category: 'Funktion fehlt',
    roleContext: '',
    message: '',
    pageUrl: '/',
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [pendingFeedbackAfterAuth, setPendingFeedbackAfterAuth] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !pendingTransportData) return;

    setShowTransportForm(true);
    toast.success('Preisberechnung übernommen', {
      description: 'Die Daten aus dem KI-Preisrechner wurden in den Transportauftrag übertragen.',
    });
  }, [isAuthenticated, pendingTransportData]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    toast.success('Erfolgreich abgemeldet');
  };

  const handleNewTransport = () => {
    setShowTransportForm(true);
  };

  const handleTransportSubmit = async (payload: TransportFormSubmitPayload) => {
    if (!user) {
      setAuthTab('login');
      setShowAuthModal(true);
      toast.error('Bitte anmelden, um den Auftrag zu veröffentlichen.');
      return false;
    }

    const response = await fetch('/api/jobs', {
      method: 'POST',
      headers: buildUserRequestHeaders(user, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Auftrag konnte nicht erstellt werden.');
    }

    if (data.actionRequired === 'WALLET_TOPUP_REQUIRED') {
      toast.warning('Auftrag als Entwurf gespeichert', {
        description: data.message || 'Bitte Zahlung vorbereiten, damit der Auftrag online gehen kann.',
      });
      setShowTransportForm(false);
      setPendingTransportData(null);
      if (data.jobId) {
        window.location.href = `/orders/${data.jobId}`;
      }
      return true;
    }

    if (data.actionRequired === 'PRICE_REQUIRED') {
      toast.warning('Preis fehlt', {
        description: data.message || 'Bitte KI-Preis oder Budget prüfen.',
      });
      return false;
    }

    setShowTransportForm(false);
    setPendingTransportData(null);
    toast.success('Auftrag veröffentlicht', {
      description: 'Ihr Auftrag wurde erstellt. Transporteure können jetzt Angebote abgeben.',
    });

    if (data.jobId) {
      window.location.href = `/orders/${data.jobId}`;
    }

    return true;
  };

  const updateQuickQuote = (field: keyof QuickQuoteForm, value: string) => {
    setQuickQuoteForm((prev) => ({ ...prev, [field]: value }));
  };

  const quickQuoteNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  };

  const quickQuoteVolumeM3 = () => {
    if (quickQuoteForm.transportType === 'bulk') {
      return quickQuoteNumber(quickQuoteForm.bulkVolumeM3);
    }

    if (quickQuoteForm.transportType === 'liquid') {
      const amount = quickQuoteNumber(quickQuoteForm.liquidAmount);
      if (!amount) return undefined;
      return quickQuoteForm.liquidAmountUnit === 'm3'
        ? amount
        : Math.round((amount / 1000) * 100) / 100;
    }

    if (['car_transport', 'oversize', 'lowloader'].includes(quickQuoteForm.transportType)) {
      const length = quickQuoteNumber(quickQuoteForm.vehicleLengthM);
      const width = quickQuoteNumber(quickQuoteForm.vehicleWidthM);
      const height = quickQuoteNumber(quickQuoteForm.vehicleHeightM);
      const count = quickQuoteForm.transportType === 'car_transport' ? quickQuoteNumber(quickQuoteForm.vehicleCount) || 1 : 1;
      if (!length || !width || !height) return undefined;
      return Math.round((length * width * height * count) * 100) / 100;
    }

    if (quickQuoteForm.transportType === 'container') {
      return CONTAINER_VOLUME_M3[quickQuoteForm.containerType];
    }

    const length = Number(quickQuoteForm.lengthCm);
    const width = Number(quickQuoteForm.widthCm);
    const height = Number(quickQuoteForm.heightCm);
    if (!Number.isFinite(length) || !Number.isFinite(width) || !Number.isFinite(height)) return undefined;
    if (length <= 0 || width <= 0 || height <= 0) return undefined;
    return Math.round((length * width * height / 1_000_000) * 100) / 100;
  };

  const quickQuoteWeightKg = () => {
    if (quickQuoteForm.transportType === 'car_transport') {
      return quickQuoteNumber(quickQuoteForm.vehicleWeightKg) || quickQuoteNumber(quickQuoteForm.weightKg) || 1500;
    }

    if (['oversize', 'lowloader'].includes(quickQuoteForm.transportType)) {
      return quickQuoteNumber(quickQuoteForm.vehicleWeightKg) || quickQuoteNumber(quickQuoteForm.weightKg) || 10_000;
    }

    if (quickQuoteForm.transportType === 'bulk') {
      const enteredWeight = quickQuoteNumber(quickQuoteForm.weightKg);
      const volume = quickQuoteNumber(quickQuoteForm.bulkVolumeM3);
      const density = quickQuoteNumber(quickQuoteForm.bulkDensityKgM3);
      if (enteredWeight) return enteredWeight;
      if (volume && density) return Math.round(volume * density);
      return 1000;
    }

    if (quickQuoteForm.transportType === 'liquid') {
      const enteredWeight = quickQuoteNumber(quickQuoteForm.weightKg);
      const amount = quickQuoteNumber(quickQuoteForm.liquidAmount);
      if (enteredWeight) return enteredWeight;
      if (!amount) return 1000;
      return quickQuoteForm.liquidAmountUnit === 'm3' ? Math.round(amount * 1000) : Math.round(amount);
    }

    return quickQuoteNumber(quickQuoteForm.weightKg) || 500;
  };

  const quickQuoteSummary = () => {
    const config = getCargoTypeConfig(quickQuoteForm.transportType);
    const weight = `${quickQuoteWeightKg().toLocaleString('de-DE')} kg`;
    const volume = quickQuoteVolumeM3();
    const volumeLabel = volume ? `${volume.toLocaleString('de-DE')} m³` : null;

    if (quickQuoteForm.transportType === 'car_transport') {
      const vehicleLabel = VEHICLE_TYPE_OPTIONS.find((option) => option.value === quickQuoteForm.vehicleSubtype)?.label || 'Fahrzeug';
      const dimensions = [quickQuoteForm.vehicleLengthM, quickQuoteForm.vehicleWidthM, quickQuoteForm.vehicleHeightM].filter(Boolean).join(' × ');
      return [vehicleLabel, dimensions ? `${dimensions} m` : null, weight].filter(Boolean).join(' • ') || config.example;
    }

    if (['oversize', 'lowloader'].includes(quickQuoteForm.transportType)) {
      const dimensions = [quickQuoteForm.vehicleLengthM, quickQuoteForm.vehicleWidthM, quickQuoteForm.vehicleHeightM].filter(Boolean).join(' × ');
      return [config.shortLabel, dimensions ? `${dimensions} m` : null, weight].filter(Boolean).join(' • ') || config.example;
    }

    if (quickQuoteForm.transportType === 'liquid') {
      const amount = quickQuoteForm.liquidAmount
        ? `${Number(quickQuoteForm.liquidAmount).toLocaleString('de-DE')} ${quickQuoteForm.liquidAmountUnit === 'm3' ? 'm³' : 'Liter'}`
        : null;
      return [quickQuoteForm.liquidProduct || 'Flüssigkeit', amount, volumeLabel, weight].filter(Boolean).join(' • ') || config.example;
    }

    if (quickQuoteForm.transportType === 'bulk') {
      return [quickQuoteForm.bulkMaterial || 'Schüttgut', volumeLabel, quickQuoteForm.bulkDensityKgM3 ? `${quickQuoteForm.bulkDensityKgM3} kg/m³` : null, weight].filter(Boolean).join(' • ') || config.example;
    }

    return [config.shortLabel, weight, volumeLabel].filter(Boolean).join(' • ');
  };

  const buildTransportInitialData = (quote?: QuickQuoteResult | null): TransportFormInitialData => ({
    pickupCity: quickQuoteForm.pickupCity,
    pickupCountry: 'Deutschland',
    deliveryCity: quickQuoteForm.deliveryCity,
    deliveryCountry: 'Deutschland',
    description: `${SPECIAL_TRANSPORT_LABELS[quickQuoteForm.transportType]} über CargoBit Preisrechner`,
    weight: String(quickQuoteWeightKg()),
    length: quickQuoteForm.lengthCm,
    width: quickQuoteForm.widthCm,
    height: quickQuoteForm.heightCm,
    cargoValue: quickQuoteForm.cargoValueEur,
    hazmat: quickQuoteForm.transportType === 'hazmat',
    transportType: quickQuoteForm.transportType,
    bulkMaterial: quickQuoteForm.bulkMaterial,
    bulkVolume: quickQuoteForm.bulkVolumeM3,
    bulkDensity: quickQuoteForm.bulkDensityKgM3,
    liquidProduct: quickQuoteForm.liquidProduct,
    liquidAmount: quickQuoteForm.liquidAmount,
    liquidAmountUnit: quickQuoteForm.liquidAmountUnit,
    liquidContainerType: quickQuoteForm.liquidContainerType,
    vehicleSubtype: quickQuoteForm.vehicleSubtype,
    vehicleLengthM: quickQuoteForm.vehicleLengthM,
    vehicleWidthM: quickQuoteForm.vehicleWidthM,
    vehicleHeightM: quickQuoteForm.vehicleHeightM,
    vehicleWeightKg: quickQuoteForm.vehicleWeightKg,
    carCount: quickQuoteForm.vehicleCount,
    carCondition: quickQuoteForm.vehicleCondition,
    oversizeLength: quickQuoteForm.transportType === 'oversize' ? quickQuoteForm.vehicleLengthM : '',
    oversizeWidth: quickQuoteForm.transportType === 'oversize' ? quickQuoteForm.vehicleWidthM : '',
    oversizeHeight: quickQuoteForm.transportType === 'oversize' ? quickQuoteForm.vehicleHeightM : '',
    lowloaderCargoLength: quickQuoteForm.transportType === 'lowloader' ? quickQuoteForm.vehicleLengthM : '',
    lowloaderCargoWidth: quickQuoteForm.transportType === 'lowloader' ? quickQuoteForm.vehicleWidthM : '',
    lowloaderCargoHeight: quickQuoteForm.transportType === 'lowloader' ? quickQuoteForm.vehicleHeightM : '',
    lowloaderCargoWeight: quickQuoteForm.transportType === 'lowloader' ? quickQuoteForm.vehicleWeightKg : '',
    budget: quote?.recommendedPrice ? String(Math.round(quote.recommendedPrice)) : '',
    aiSuggestedPrice: quote?.recommendedPrice ? Math.round(quote.recommendedPrice) : undefined,
  });

  const calculateQuickQuote = async () => {
    const normalizedWeightKg = quickQuoteWeightKg();
    if (!quickQuoteForm.pickupCity || !quickQuoteForm.deliveryCity || !normalizedWeightKg) {
      setQuickQuoteError('Bitte Abholort, Zielort und passende Frachtdaten eingeben.');
      return;
    }

    setQuickQuoteLoading(true);
    setQuickQuoteError(null);

    try {
      const response = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup: {
            city: quickQuoteForm.pickupCity,
            country: 'Deutschland',
          },
          delivery: {
            city: quickQuoteForm.deliveryCity,
            country: 'Deutschland',
          },
          weightKg: normalizedWeightKg,
          volumeM3: quickQuoteVolumeM3(),
          transportType: quickQuoteForm.transportType,
          cargoDetails: {
            transportType: quickQuoteForm.transportType,
            summary: quickQuoteSummary(),
            measurementMode: getCargoTypeConfig(quickQuoteForm.transportType).measurementMode,
          },
          isHazmat: quickQuoteForm.transportType === 'hazmat',
          requiresCooling: quickQuoteForm.transportType === 'cooling',
          riskLevel: quickQuoteForm.transportType === 'hazmat' ? 'yellow' : 'green',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Preis konnte nicht berechnet werden.');
      }

      setQuickQuoteResult(data);
    } catch (error) {
      setQuickQuoteError(error instanceof Error ? error.message : 'Preis konnte nicht berechnet werden.');
    } finally {
      setQuickQuoteLoading(false);
    }
  };

  const publishQuickQuote = () => {
    const initialData = buildTransportInitialData(quickQuoteResult);
    setPendingTransportData(initialData);

    if (isAuthenticated) {
      setShowTransportForm(true);
      return;
    }

    setAuthTab('register');
    setShowAuthModal(true);
  };

  const renderQuickQuoteCargoFields = () => {
    const config = getCargoTypeConfig(quickQuoteForm.transportType);
    const inputClass = 'h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#00D4FF]/60';
    const compactInputClass = 'h-12 rounded-xl border border-white/10 bg-[#06121C]/70 px-3 text-white outline-none transition focus:border-[#00D4FF]/60';

    if (quickQuoteForm.transportType === 'car_transport') {
      return (
        <>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Fahrzeugtyp</span>
            <select
              value={quickQuoteForm.vehicleSubtype}
              onChange={(event) => updateQuickQuote('vehicleSubtype', event.target.value)}
              className={inputClass}
            >
              {VEHICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Anzahl / Zustand</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={quickQuoteForm.vehicleCount}
                onChange={(event) => updateQuickQuote('vehicleCount', event.target.value)}
                className={compactInputClass}
                placeholder="1"
              />
              <select
                value={quickQuoteForm.vehicleCondition}
                onChange={(event) => updateQuickQuote('vehicleCondition', event.target.value)}
                className={compactInputClass}
              >
                <option value="fahrbereit">Fahrbereit</option>
                <option value="nicht_fahrbereit">Nicht fahrbereit</option>
              </select>
            </div>
          </label>
          {renderMeterDimensionFields('Fahrzeugmaße und Gewicht')}
        </>
      );
    }

    if (['oversize', 'lowloader'].includes(quickQuoteForm.transportType)) {
      return renderMeterDimensionFields(config.dimensionLabel);
    }

    if (quickQuoteForm.transportType === 'liquid') {
      return (
        <>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Produkt</span>
            <input
              value={quickQuoteForm.liquidProduct}
              onChange={(event) => updateQuickQuote('liquidProduct', event.target.value)}
              className={inputClass}
              placeholder="z.B. Wasser, Öl, Chemikalie"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Menge</span>
            <div className="grid grid-cols-[1fr_112px] gap-2">
              <input
                type="number"
                value={quickQuoteForm.liquidAmount}
                onChange={(event) => updateQuickQuote('liquidAmount', event.target.value)}
                className={compactInputClass}
                placeholder="25000"
              />
              <select
                value={quickQuoteForm.liquidAmountUnit}
                onChange={(event) => updateQuickQuote('liquidAmountUnit', event.target.value)}
                className={compactInputClass}
              >
                {LIQUID_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Behälterart</span>
            <select
              value={quickQuoteForm.liquidContainerType}
              onChange={(event) => updateQuickQuote('liquidContainerType', event.target.value)}
              className={inputClass}
            >
              <option value="tankauflieger">Tankauflieger</option>
              <option value="ibc">IBC</option>
              <option value="fass">Fass</option>
              <option value="tankcontainer">Tankcontainer</option>
            </select>
          </label>
        </>
      );
    }

    if (quickQuoteForm.transportType === 'bulk') {
      return (
        <>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Material</span>
            <input
              value={quickQuoteForm.bulkMaterial}
              onChange={(event) => updateQuickQuote('bulkMaterial', event.target.value)}
              className={inputClass}
              placeholder="z.B. Sand, Kies, Getreide"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Volumen / Dichte</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={quickQuoteForm.bulkVolumeM3}
                onChange={(event) => updateQuickQuote('bulkVolumeM3', event.target.value)}
                className={compactInputClass}
                placeholder="m³"
              />
              <input
                type="number"
                value={quickQuoteForm.bulkDensityKgM3}
                onChange={(event) => updateQuickQuote('bulkDensityKgM3', event.target.value)}
                className={compactInputClass}
                placeholder="kg/m³"
              />
            </div>
          </label>
        </>
      );
    }

    if (quickQuoteForm.transportType === 'container') {
      return (
        <>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Containertyp</span>
            <select
              value={quickQuoteForm.containerType}
              onChange={(event) => updateQuickQuote('containerType', event.target.value)}
              className={inputClass}
            >
              <option value="20ft">20ft Standard</option>
              <option value="40ft">40ft Standard</option>
              <option value="45ft">45ft Standard</option>
              <option value="reefer">Kühlcontainer</option>
              <option value="tank">Tankcontainer</option>
              <option value="open_top">Open Top</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-gray-300">Bruttogewicht (kg)</span>
            <input
              type="number"
              value={quickQuoteForm.weightKg}
              onChange={(event) => updateQuickQuote('weightKg', event.target.value)}
              className={inputClass}
              placeholder="z.B. 24000"
            />
          </label>
        </>
      );
    }

    return (
      <>
        <label className="space-y-2">
          <span className="text-sm text-gray-300">{config.weightLabel}</span>
          <input
            type="number"
            value={quickQuoteForm.weightKg}
            onChange={(event) => updateQuickQuote('weightKg', event.target.value)}
            className={inputClass}
            placeholder="500 kg"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-gray-300">Maße optional (cm)</span>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" value={quickQuoteForm.lengthCm} onChange={(event) => updateQuickQuote('lengthCm', event.target.value)} className={compactInputClass} placeholder="L" />
            <input type="number" value={quickQuoteForm.widthCm} onChange={(event) => updateQuickQuote('widthCm', event.target.value)} className={compactInputClass} placeholder="B" />
            <input type="number" value={quickQuoteForm.heightCm} onChange={(event) => updateQuickQuote('heightCm', event.target.value)} className={compactInputClass} placeholder="H" />
          </div>
        </label>
      </>
    );
  };

  const renderMeterDimensionFields = (label: string) => {
    const compactInputClass = 'h-12 rounded-xl border border-white/10 bg-[#06121C]/70 px-3 text-white outline-none transition focus:border-[#00D4FF]/60';
    return (
      <label className="space-y-2 sm:col-span-2">
        <span className="text-sm text-gray-300">{label}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input type="number" step="0.1" value={quickQuoteForm.vehicleLengthM} onChange={(event) => updateQuickQuote('vehicleLengthM', event.target.value)} className={compactInputClass} placeholder="Länge m" />
          <input type="number" step="0.1" value={quickQuoteForm.vehicleWidthM} onChange={(event) => updateQuickQuote('vehicleWidthM', event.target.value)} className={compactInputClass} placeholder="Breite m" />
          <input type="number" step="0.1" value={quickQuoteForm.vehicleHeightM} onChange={(event) => updateQuickQuote('vehicleHeightM', event.target.value)} className={compactInputClass} placeholder="Höhe m" />
          <input type="number" value={quickQuoteForm.vehicleWeightKg} onChange={(event) => updateQuickQuote('vehicleWeightKg', event.target.value)} className={compactInputClass} placeholder="Gewicht kg" />
        </div>
      </label>
    );
  };

  const updateFeedbackForm = (field: keyof FeedbackForm, value: string) => {
    setFeedbackForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitFeedback = useCallback(async (forceSubmit = false) => {
    const message = feedbackForm.message.trim();

    if (!message) {
      toast.error('Bitte beschreibe kurz, was wir verbessern können.');
      return;
    }

    if (!forceSubmit && !isAuthenticated) {
      setPendingFeedbackAfterAuth(true);
      setFeedbackForm((prev) => ({
        ...prev,
        pageUrl: typeof window !== 'undefined' ? window.location.href : prev.pageUrl,
      }));
      setAuthTab('register');
      setShowAuthModal(true);
      toast.info('Bitte anmelden, damit wir Rückfragen stellen können.');
      return;
    }

    if (!user) {
      toast.error('Bitte anmelden, damit wir dein Feedback zuordnen können.');
      return;
    }

    setFeedbackSubmitting(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: buildUserRequestHeaders(user, { 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          category: feedbackForm.category,
          roleContext: feedbackForm.roleContext || user.role,
          message,
          pageUrl: typeof window !== 'undefined' ? window.location.href : feedbackForm.pageUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Feedback konnte nicht gesendet werden.');
      }

      setPendingFeedbackAfterAuth(false);
      setFeedbackForm({
        category: 'Funktion fehlt',
        roleContext: '',
        message: '',
        pageUrl: typeof window !== 'undefined' ? window.location.href : '/',
      });
      toast.success('Danke für dein Feedback.', {
        description: 'Wir prüfen deinen Vorschlag und nehmen ihn in die Produkt-Roadmap auf.',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Feedback konnte nicht gesendet werden.');
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackForm, isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !pendingFeedbackAfterAuth || !feedbackForm.message.trim()) return;

    const timer = window.setTimeout(() => {
      void submitFeedback(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [feedbackForm.message, isAuthenticated, pendingFeedbackAfterAuth, submitFeedback]);

  if (showOnboarding) {
    return <TransporteurOnboarding />;
  }

  if (showShipperOnboarding) {
    return <ShipperOnboarding />;
  }

  if (showPartnerPortal) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <PartnerPortal />
        <Button
          className="fixed bottom-4 right-4 gap-2 shadow-lg"
          onClick={() => setShowPartnerPortal(false)}
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          Zurück zur Hauptseite
        </Button>
      </>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <Dashboard onLogout={handleLogout} onNewTransport={handleNewTransport} />
        <TransportForm
          open={showTransportForm}
          onOpenChange={setShowTransportForm}
          onSubmit={handleTransportSubmit}
          initialData={pendingTransportData}
        />
      </>
    );
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-[#06121C]">
        {/* Navigation */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#06121C]/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 lg:h-20">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center shadow-lg">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold text-white">CargoBit</span>
                  <span className="text-xs text-[#00D4FF]">Transporte in Europa</span>
                </div>
              </div>

              {/* Desktop Nav */}
              <div className="hidden lg:flex items-center gap-8">
                <button onClick={() => scrollToSection('preisrechner')} className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium">
                  Preisrechner
                </button>
                <button onClick={() => scrollToSection('matching')} className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium">
                  Matching
                </button>
                <button onClick={() => scrollToSection('preise')} className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium">
                  Preise
                </button>
                <button onClick={() => scrollToSection('features')} className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium">
                  Zahlungsschutz
                </button>
                <button onClick={() => scrollToSection('support')} className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium">
                  Support
                </button>
                <button onClick={() => scrollToSection('verbesserungen')} className="text-gray-300 hover:text-[#00D4FF] transition-colors font-medium">
                  Verbesserungen
                </button>
              </div>

              {/* Right Side */}
              <div className="hidden lg:flex items-center gap-4">
                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setLangOpen(!langOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-sm">DE</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {langOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-[#0B3C5D] border border-[#1C7ED6]/30 rounded-lg shadow-xl py-2 min-w-[140px]">
                      {['DE', 'EN', 'PL', 'CZ', 'RO', 'SL', 'SK', 'TR', 'EL', 'FR'].map(lang => (
                        <button key={lang} className="w-full px-4 py-2 text-left hover:bg-[#1C7ED6]/20 transition-colors text-sm text-gray-300">
                          {lang}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-300 hover:text-white"
                  onClick={() => { setAuthTab('login'); setShowAuthModal(true); }}
                >
                  Anmelden
                </Button>
                <Button 
                  size="sm" 
                  className="bg-[#1C7ED6] hover:bg-[#1C7ED6]/80 gap-2"
                  onClick={() => { setAuthTab('register'); setShowAuthModal(true); }}
                >
                  Jetzt registrieren
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-300"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="lg:hidden bg-[#0B3C5D] border-t border-[#1C7ED6]/30 shadow-xl">
              <div className="px-4 py-6 space-y-4">
                <button onClick={() => scrollToSection('preisrechner')} className="block w-full text-left py-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
                  Preisrechner
                </button>
                <button onClick={() => scrollToSection('matching')} className="block w-full text-left py-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
                  Matching
                </button>
                <button onClick={() => scrollToSection('preise')} className="block w-full text-left py-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
                  Preise
                </button>
                <button onClick={() => scrollToSection('features')} className="block w-full text-left py-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
                  Zahlungsschutz
                </button>
                <button onClick={() => scrollToSection('support')} className="block w-full text-left py-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
                  Support
                </button>
                <button onClick={() => scrollToSection('verbesserungen')} className="block w-full text-left py-2 text-gray-300 hover:text-[#00D4FF] transition-colors">
                  Verbesserungen
                </button>
                <Separator className="bg-[#1C7ED6]/30" />
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-[#1C7ED6]/50 text-gray-300"
                    onClick={() => { setAuthTab('login'); setShowAuthModal(true); setIsMenuOpen(false); }}
                  >
                    Anmelden
                  </Button>
                  <Button 
                    className="flex-1 bg-[#1C7ED6] hover:bg-[#1C7ED6]/80"
                    onClick={() => { setAuthTab('register'); setShowAuthModal(true); setIsMenuOpen(false); }}
                  >
                    Jetzt registrieren
                  </Button>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
          {/* Background - Dark blue world map with glowing connections */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#06121C] via-[#0B3C5D]/50 to-[#06121C]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#1C7ED6]/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00D4FF]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          
          {/* Connection lines pattern */}
          <div className="absolute inset-0 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 1920 1080">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1C7ED6" stopOpacity="0" />
                  <stop offset="50%" stopColor="#00D4FF" stopOpacity="1" />
                  <stop offset="100%" stopColor="#1C7ED6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Connection lines */}
              <circle cx="300" cy="300" r="4" fill="#00D4FF" className="animate-pulse" />
              <circle cx="600" cy="500" r="4" fill="#00D4FF" className="animate-pulse" />
              <circle cx="900" cy="250" r="4" fill="#00D4FF" className="animate-pulse" />
              <circle cx="1200" cy="450" r="4" fill="#00D4FF" className="animate-pulse" />
              <circle cx="1500" cy="350" r="4" fill="#00D4FF" className="animate-pulse" />
              <line x1="300" y1="300" x2="600" y2="500" stroke="url(#lineGradient)" strokeWidth="1" />
              <line x1="600" y1="500" x2="900" y2="250" stroke="url(#lineGradient)" strokeWidth="1" />
              <line x1="900" y1="250" x2="1200" y2="450" stroke="url(#lineGradient)" strokeWidth="1" />
              <line x1="1200" y1="450" x2="1500" y2="350" stroke="url(#lineGradient)" strokeWidth="1" />
            </svg>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="text-center lg:text-left">
                {/* Tagline */}
                <Badge className="mb-6 px-4 py-2 text-sm gap-2 bg-[#1C7ED6]/20 text-[#00D4FF] border border-[#00D4FF]/30">
                  <Globe className="w-4 h-4" />
                  Europaweit vernetzt
                </Badge>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-white">
                  Digitale Transportplattform mit KI-Preisrechner
                  <br />
                  <span className="text-[#00D4FF]">für Fracht, Speditionen und Sondertransporte.</span>
                </h1>

                {/* Description */}
                <p className="text-lg text-gray-300 max-w-xl mx-auto lg:mx-0 mb-8">
                  Berechnen Sie realistische Preise für Fracht, Sondertransporte und Speditionsaufträge. CargoBit verbindet Verlader, Privatpersonen, Gewerbekunden, Transporteure und Fahrer.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                  <Button 
                    size="lg" 
                    className="gap-2 px-8 h-14 text-lg bg-[#1C7ED6] hover:bg-[#1C7ED6]/80 shadow-xl"
                    onClick={() => scrollToSection('preisrechner')}
                  >
                    Transportpreis berechnen
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="gap-2 px-8 h-14 text-lg border-gray-600 text-gray-300 hover:bg-white/10"
                    onClick={publishQuickQuote}
                  >
                    <Package className="w-5 h-5" />
                    Auftrag erstellen
                  </Button>
                </div>

                {/* Feature Badges */}
                <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                  <div className="flex items-center gap-2 bg-[#0B3C5D]/50 rounded-full px-4 py-2 border border-[#1C7ED6]/30">
                    <Star className="w-4 h-4 text-[#00D4FF]" />
                    <span className="text-sm text-gray-300">KI-Preisempfehlung</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#0B3C5D]/50 rounded-full px-4 py-2 border border-[#1C7ED6]/30">
                    <MapPin className="w-4 h-4 text-[#00D4FF]" />
                    <span className="text-sm text-gray-300">Live Tracking</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#0B3C5D]/50 rounded-full px-4 py-2 border border-[#1C7ED6]/30">
                    <Shield className="w-4 h-4 text-[#00D4FF]" />
                    <span className="text-sm text-gray-300">Sichere Zahlung</span>
                  </div>
                </div>
              </div>

              {/* Right Content - Live Transport Widget */}
              <div className="hidden lg:block">
                <div className="relative">
                  {/* Main Dashboard Preview */}
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#1C7ED6]/30 bg-[#0B3C5D]">
                    <Image
                      src="/images/dashboard-main.png"
                      alt="CargoBit Dashboard"
                      width={800}
                      height={500}
                      className="w-full h-auto object-cover"
                      priority
                    />
                  </div>
                  
                  {/* Live Transport Widget */}
                  <div className="absolute -bottom-6 -left-6 bg-[#0B3C5D] border border-[#1C7ED6]/30 rounded-xl p-4 shadow-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1C7ED6]/20 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-[#00D4FF]" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Live Transport</div>
                        <div className="text-sm font-semibold text-white">Hamburg → Barcelona</div>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs text-green-400">unterwegs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KI Price Calculator Lead Magnet */}
        <section id="preisrechner" className="py-24 bg-[#081824]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
              <div>
                <Badge className="mb-4 bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
                  TRANSPORTPREIS ONLINE BERECHNEN
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Sie möchten etwas verschicken und wissen nicht, was es kostet?
                </h2>
                <p className="text-lg leading-8 text-gray-300">
                  Geben Sie Strecke, Frachtart und Gewicht ein. CargoBit berechnet einen realistischen Preis als Orientierung.
                  Danach können Sie den Transportauftrag veröffentlichen und Speditionen oder Transporteure können Angebote abgeben.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    ['1', 'Preis berechnen', 'KI-Schätzung für Route, Fracht, Maut, Fahrzeit und Risiko.'],
                    ['2', 'Anmelden', 'Daten übernehmen und den Auftrag mit Zahlungsschutz vorbereiten.'],
                    ['3', 'Angebote erhalten', 'Transporteure können annehmen oder günstiger bieten.'],
                    ['4', 'Sicher abwickeln', 'POD, Rechnung, Auszahlung und Trust Gate bleiben nachvollziehbar.'],
                  ].map(([number, title, detail]) => (
                    <div key={number} className="rounded-2xl border border-[#1C7ED6]/20 bg-[#0B3C5D]/40 p-4">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#1C7ED6]/20 text-sm font-bold text-[#00D4FF]">
                        {number}
                      </div>
                      <h3 className="font-semibold text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-400">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#0B3C5D]/60 p-5 shadow-2xl shadow-[#00D4FF]/10">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">KI-Preisrechner</h3>
                    <p className="mt-1 text-sm text-gray-400">Orientierungspreis, kein verbindliches Angebot.</p>
                  </div>
                  <div className="rounded-xl bg-[#00D4FF]/10 p-3 text-[#00D4FF]">
                    <Calculator className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-gray-300">Abholort</span>
                    <input
                      value={quickQuoteForm.pickupCity}
                      onChange={(event) => updateQuickQuote('pickupCity', event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#00D4FF]/60"
                      placeholder="z.B. Hamburg"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-gray-300">Zielort</span>
                    <input
                      value={quickQuoteForm.deliveryCity}
                      onChange={(event) => updateQuickQuote('deliveryCity', event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#00D4FF]/60"
                      placeholder="z.B. München"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-gray-300">Frachtart</span>
                    <select
                      value={quickQuoteForm.transportType}
                      onChange={(event) => updateQuickQuote('transportType', event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#00D4FF]/60"
                    >
                      {CARGO_TYPE_CONFIGS.map((config) => (
                        <option key={config.value} value={config.value}>{config.shortLabel}</option>
                      ))}
                    </select>
                  </label>
                  {renderQuickQuoteCargoFields()}
                  <label className="space-y-2">
                    <span className="text-sm text-gray-300">Warenwert optional</span>
                    <input
                      type="number"
                      value={quickQuoteForm.cargoValueEur}
                      onChange={(event) => updateQuickQuote('cargoValueEur', event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#00D4FF]/60"
                      placeholder="z.B. 12000 EUR"
                    />
                  </label>
                </div>
                <div className="mt-4 rounded-xl border border-[#00D4FF]/15 bg-[#00D4FF]/5 p-3 text-sm text-gray-300">
                  <span className="font-medium text-white">{getCargoTypeConfig(quickQuoteForm.transportType).label}:</span>{' '}
                  {quickQuoteSummary()}
                  <div className="mt-1 text-xs text-gray-500">
                    {getCargoTypeConfig(quickQuoteForm.transportType).example}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="h-12 flex-1 gap-2 bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] hover:opacity-90"
                    onClick={calculateQuickQuote}
                    disabled={quickQuoteLoading}
                  >
                    {quickQuoteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                    Preis berechnen
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-12 h-auto flex-1 border-[#00D4FF]/30 py-3 text-[#00D4FF] hover:bg-[#00D4FF]/10"
                    onClick={publishQuickQuote}
                  >
                    {isAuthenticated ? 'Angebot veröffentlichen' : 'Kostenlos anmelden und Angebot veröffentlichen'}
                  </Button>
                </div>

                {quickQuoteError ? (
                  <div className="mt-4 rounded-xl border border-[#F39C12]/30 bg-[#F39C12]/10 p-3 text-sm text-[#ffd79a]">
                    {quickQuoteError}
                  </div>
                ) : null}

                {quickQuoteResult ? (
                  <div className="mt-5 rounded-2xl border border-[#00D4FF]/20 bg-[#06121C]/70 p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-400">Empfohlener realistischer Preis</p>
                        <p className="mt-1 text-4xl font-bold text-white">
                          {formatCurrency(quickQuoteResult.recommendedPrice)}
                        </p>
                      </div>
                      <Badge className="w-fit bg-[#2ECC71]/15 text-[#8ff0b4] border border-[#2ECC71]/25">
                        {Math.round(quickQuoteResult.confidence * 100)}% Konfidenz
                      </Badge>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-xs text-gray-500">Mindestpreis</p>
                        <p className="mt-1 font-semibold text-white">{formatCurrency(quickQuoteResult.minPrice)}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-xs text-gray-500">Entfernung</p>
                        <p className="mt-1 font-semibold text-white">{Math.round(quickQuoteResult.route.distanceKm)} km</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.04] p-3">
                        <p className="text-xs text-gray-500">Maut/Fahrzeit</p>
                        <p className="mt-1 font-semibold text-white">
                          {formatCurrency(quickQuoteResult.route.tollCost)} · {Math.round(quickQuoteResult.route.durationMinutes / 60)}h
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-gray-400">
                      {quickQuoteForm.transportType === 'pallet'
                        ? 'Speditionen können Angebote abgeben und günstiger bieten, solange Mindestpreis und Trust-Regeln eingehalten werden.'
                        : 'Für diese Frachtart können Spezialfahrzeuge, Versicherungen, Nachweise oder manuelle Prüfung erforderlich sein.'}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* Intelligent & Profitable Section */}
        <section id="matching" className="py-24 bg-[#06121C]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-left mb-12">
              <Badge className="mb-4 bg-[#1C7ED6]/20 text-[#00D4FF] border border-[#00D4FF]/30">INTELLIGENT & PROFITABEL</Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                KI-gestützte Preise. Maximaler Gewinn.
              </h2>
              <p className="text-lg text-gray-400 max-w-2xl">
                Unsere KI analysiert Marktdaten in Echtzeit und empfiehlt dir den optimalen Preis für jeden Transport – fair, transparent und marktgerecht.
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 items-start">
              {/* Left - Statistics and Features */}
              <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mb-3">
                        <Truck className="w-5 h-5 text-[#00D4FF]" />
                      </div>
                      <div className="text-2xl font-bold text-white">12.450+</div>
                      <div className="text-xs text-gray-400">Transporte</div>
                      <div className="text-xs text-gray-500">erfolgreich abgewickelt</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mb-3">
                        <Users className="w-5 h-5 text-[#00D4FF]" />
                      </div>
                      <div className="text-2xl font-bold text-white">8.760+</div>
                      <div className="text-xs text-gray-400">Partner</div>
                      <div className="text-xs text-gray-500">vertrauen auf CargoBit</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mb-3">
                        <Star className="w-5 h-5 text-[#00D4FF]" />
                      </div>
                      <div className="text-2xl font-bold text-white">98,6%</div>
                      <div className="text-xs text-gray-400">Zufriedenheit</div>
                      <div className="text-xs text-gray-500">unserer Kunden</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20">
                    <CardContent className="p-4">
                      <div className="w-10 h-10 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mb-3">
                        <HeadphonesIcon className="w-5 h-5 text-[#00D4FF]" />
                      </div>
                      <div className="text-2xl font-bold text-white">24/7</div>
                      <div className="text-xs text-gray-400">Support</div>
                      <div className="text-xs text-gray-500">für dich da</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Features List */}
                <div className="space-y-3">
                  {[
                    'Echtzeit-Marktanalyse',
                    'Berücksichtigung aller Kostenfaktoren',
                    'Höherer Gewinn durch smarte Algorithmen',
                    'Schnelle & datenbasierte Entscheidungen'
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#1C7ED6]/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-[#00D4FF]" />
                      </div>
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle - Price Box and Route */}
              <div className="space-y-6">
                {/* Price Box */}
                <Card className="bg-gradient-to-br from-[#0B3C5D] to-[#06121C] border border-[#1C7ED6]/30 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400">Empfohlener Preis</span>
                      <Badge className="bg-green-500/20 text-green-400 border border-green-500/30">+12% höherer Gewinn</Badge>
                    </div>
                    <div className="text-4xl font-bold text-white mb-2">€1.680</div>
                    <div className="text-sm text-gray-400">Inkl. aller Kosten</div>
                  </CardContent>
                </Card>

                {/* Route Details */}
                <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20">
                  <CardContent className="p-6">
                    <div className="text-sm text-gray-400 mb-4">Strecke</div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C7ED6]/20 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-[#00D4FF]" />
                        </div>
                        <div>
                          <div className="text-white font-medium">Hamburg</div>
                          <div className="text-xs text-gray-500">Deutschland</div>
                        </div>
                      </div>
                      <div className="flex-1 mx-4 border-t-2 border-dashed border-[#1C7ED6]/30" />
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#1C7ED6]/20 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-[#00D4FF]" />
                        </div>
                        <div>
                          <div className="text-white font-medium">Barcelona</div>
                          <div className="text-xs text-gray-500">Spanien</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-6 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <span>1.893 km</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>24h 30m</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right - Map */}
              <div className="relative">
                <div className="relative rounded-2xl overflow-hidden border border-[#1C7ED6]/30 bg-[#0B3C5D] h-full min-h-[400px]">
                  <Image
                    src="/images/dashboard-main.png"
                    alt="Route Map Hamburg Barcelona"
                    fill
                    className="object-cover opacity-90"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Solutions Section */}
        <section id="features" className="py-24 bg-[#0B3C5D]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Eine Plattform. Alle Lösungen.
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
              {/* Matching Card */}
              <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20 hover:border-[#00D4FF]/50 transition-all group">
                <CardContent className="pt-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Truck className="w-7 h-7 text-[#00D4FF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Matching</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Finde den passenden Transport oder die ideale Fracht in Sekunden.
                  </p>
                  <Button variant="ghost" size="sm" className="text-[#00D4FF] hover:text-[#00D4FF]/80">
                    Mehr erfahren →
                  </Button>
                </CardContent>
              </Card>

              {/* Live Tracking Card */}
              <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20 hover:border-[#00D4FF]/50 transition-all group">
                <CardContent className="pt-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <MapPin className="w-7 h-7 text-[#00D4FF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Live Tracking</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Verfolge jeden Transport in Echtzeit – jederzeit und überall.
                  </p>
                  <Button variant="ghost" size="sm" className="text-[#00D4FF] hover:text-[#00D4FF]/80">
                    Mehr erfahren →
                  </Button>
                </CardContent>
              </Card>

              {/* Sichere Zahlung Card */}
              <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20 hover:border-[#00D4FF]/50 transition-all group">
                <CardContent className="pt-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Shield className="w-7 h-7 text-[#00D4FF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Sichere Zahlung</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Auftragsbezogener Zahlungsschutz, einfache Zahlungen und schnelle Auszahlungen.
                  </p>
                  <Button variant="ghost" size="sm" className="text-[#00D4FF] hover:text-[#00D4FF]/80">
                    Mehr erfahren →
                  </Button>
                </CardContent>
              </Card>

              {/* Dokumente Card */}
              <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20 hover:border-[#00D4FF]/50 transition-all group">
                <CardContent className="pt-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="w-7 h-7 text-[#00D4FF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Dokumente</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Digitale Dokumente verwalten und jederzeit verfügbar haben.
                  </p>
                  <Button variant="ghost" size="sm" className="text-[#00D4FF] hover:text-[#00D4FF]/80">
                    Mehr erfahren →
                  </Button>
                </CardContent>
              </Card>

              {/* Support Card */}
              <Card className="bg-[#0B3C5D]/50 border border-[#1C7ED6]/20 hover:border-[#00D4FF]/50 transition-all group">
                <CardContent className="pt-6 text-center">
                  <div className="w-14 h-14 rounded-xl bg-[#1C7ED6]/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <HeadphonesIcon className="w-7 h-7 text-[#00D4FF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Support</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Unser Support-Team ist 24/7 für dich verfügbar.
                  </p>
                  <Button variant="ghost" size="sm" className="text-[#00D4FF] hover:text-[#00D4FF]/80">
                    Mehr erfahren →
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Public Pricing Section */}
        <section id="preise" className="py-24 bg-[#06121C]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between mb-12">
              <div>
                <Badge className="mb-4 bg-[#1C7ED6]/20 text-[#00D4FF] border border-[#00D4FF]/30">
                  PREISE & LEISTUNGEN
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Einfach starten: Provision oder Business.
                </h2>
                <p className="text-lg text-gray-400 max-w-3xl">
                  CargoBit startet mit einem schlanken Gebührenmodell: ohne Grundgebühr für gelegentliche Aufträge oder Business für regelmäßiges Transportvolumen.
                </p>
              </div>
              <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 px-5 py-4 text-sm text-cyan-100">
                Business 89 € netto/Monat zzgl. MwSt.
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {PUBLIC_PRICING_ORDER.map((planKey) => {
                const plan = PUBLIC_PRICING_PLANS[planKey];
                const isRecommended = planKey === 'starter';
                const isFree = planKey === 'free';

                return (
                  <Card
                    key={planKey}
                    className={`relative overflow-hidden border transition-all hover:-translate-y-1 ${
                      isRecommended
                        ? 'border-[#00D4FF]/50 bg-[#0B3C5D] shadow-2xl shadow-[#00D4FF]/10'
                        : 'border-[#1C7ED6]/20 bg-[#0B3C5D]/50'
                    }`}
                  >
                    {isRecommended && (
                      <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] px-3 py-1 text-xs font-semibold text-white">
                        Empfohlen
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1C7ED6]/20 text-[#00D4FF]">
                        {isFree ? <Package className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
                      </div>
                      <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                      <p className="mt-3 min-h-16 text-sm leading-6 text-gray-400">
                        {PUBLIC_PLAN_DESCRIPTIONS[planKey]}
                      </p>

                      <div className="mt-6 rounded-2xl border border-white/10 bg-[#06121C]/60 p-4">
                        <div className="flex items-end gap-2">
                          <span className="text-4xl font-bold text-white">
                            {formatCurrency(plan.monthlyFee)}
                          </span>
                          <span className="pb-1 text-sm text-gray-400">/ Monat</span>
                        </div>
                        {isFree ? (
                          <p className="mt-2 text-sm text-gray-400">
                            10 Aufträge pro Monat
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-gray-400">
                            30 Aufträge pro Monat
                          </p>
                        )}
                        <p className="mt-3 text-xs text-cyan-200">
                          {isFree
                            ? 'Keine Grundgebühr. Gebühren fallen nur bei Nutzung an.'
                            : `zzgl. ${plan.vatPercent}% MwSt. · Brutto monatlich ${formatCurrency(plan.monthlyGrossFee, 2)}`}
                        </p>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[#1C7ED6]/20 bg-[#06121C]/40 p-3">
                          <p className="text-xs text-gray-500">Provision</p>
                          <p className="mt-1 text-lg font-semibold text-white">{plan.commissionPercent}%</p>
                        </div>
                        <div className="rounded-xl border border-[#1C7ED6]/20 bg-[#06121C]/40 p-3">
                          <p className="text-xs text-gray-500">Zahlungsschutz-Gebühr</p>
                          <p className="mt-1 text-lg font-semibold text-white">{plan.walletFeePercent}%</p>
                        </div>
                      </div>

                      <ul className="mt-6 space-y-3">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex gap-3 text-sm text-gray-300">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#2ECC71]" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className={`mt-7 w-full gap-2 ${
                          isRecommended
                            ? 'bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] hover:opacity-90'
                            : 'bg-[#1C7ED6] hover:bg-[#1C7ED6]/80'
                        }`}
                        onClick={() => { setAuthTab('register'); setShowAuthModal(true); }}
                      >
                        {isFree ? 'Kostenlos starten' : 'Business starten'}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-[#1C7ED6]/20 bg-[#0B3C5D]/40 p-5 text-sm text-gray-300">
              Start ist auf 10 Aufträge pro Monat begrenzt und nutzt 14% Provision sowie 3,5% Zahlungsschutz-Gebühr. Business kostet 89 € netto pro Monat, enthält 30 Aufträge pro Monat und nutzt 12% CargoBit-Provision sowie 2,5% Zahlungsschutz-Gebühr.
            </div>
          </div>
        </section>

        {/* SEO Content Section */}
        <section className="py-24 bg-[#0B3C5D]/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <Badge className="mb-4 bg-[#1C7ED6]/20 text-[#00D4FF] border border-[#00D4FF]/30">
                DIGITALE LOGISTIKPLATTFORM
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Transportauftrag erstellen, Spedition finden und Angebote vergleichen.
              </h2>
              <p className="text-lg leading-8 text-gray-400">
                CargoBit ist für Menschen und Unternehmen gedacht, die Fracht transportieren lassen möchten,
                aber noch keinen realistischen Preis kennen. Die Plattform verbindet Preisberechnung, Auftrag,
                Matching, Zahlungsschutz, Verifizierung, Versicherung und digitale Transportabwicklung.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-4">
              {[
                {
                  title: 'Für Verlader',
                  text: 'Transportpreis berechnen, Frachtauftrag erstellen, Angebote vergleichen und Zahlung auftragsbezogen absichern.',
                },
                {
                  title: 'Für Privatpersonen',
                  text: 'Auch private oder einmalige Transporte können vorbereitet werden, wenn Route, Fracht und Zeitfenster klar beschrieben sind.',
                },
                {
                  title: 'Für Transporteure',
                  text: 'Passende Aufträge finden, faire Angebote abgeben und nach Lieferung über POD/eCMR die Auszahlung vorbereiten.',
                },
                {
                  title: 'Für Speditionen',
                  text: 'Teams, Dispatcher, Fahrer, Fahrzeuge, Verifizierungen und Transportprozesse digital koordinieren.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-[#1C7ED6]/20 bg-[#06121C]/60 p-5">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-400">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-[#06121C]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <Badge className="mb-4 bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/30">
                FRAGEN ZU TRANSPORTPREISEN
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Was kostet mein Transport und wer kann ihn übernehmen?
              </h2>
              <p className="text-lg leading-8 text-gray-400">
                Diese Fragen beantworten wir schon vor der Auftragserstellung: mit KI-Preisempfehlung,
                Angebotsprozess, Trust Score und transparenter Zahlungsschutz-Abwicklung.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {SEO_FAQS.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-[#1C7ED6]/20 bg-[#0B3C5D]/40 p-5">
                  <h3 className="font-semibold text-white">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-gray-400">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feedback Section */}
        <section id="verbesserungen" className="py-24 bg-[#081824]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
              <div>
                <Badge className="mb-4 bg-[#2ECC71]/10 text-[#8ff0b4] border border-[#2ECC71]/30">
                  PRODUKT-FEEDBACK
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  CargoBit verbessern
                </h2>
                <p className="text-lg leading-8 text-gray-300">
                  Eine Logistikplattform wird besser, wenn echte Nutzer ihre Arbeitsabläufe spiegeln.
                  Teile uns mit, welche Funktion fehlt, welcher Schritt zu kompliziert ist oder wo CargoBit
                  Zeit und Kosten noch besser sparen kann.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    ['Schneller lernen', 'Ideen landen direkt bei Produkt, Support und Admin.'],
                    ['Bessere Abläufe', 'Wir priorisieren Vorschläge nach Wirkung im echten Transportprozess.'],
                    ['Rückfragen möglich', 'Mit Login können wir dich kontaktieren und Details klären.'],
                  ].map(([title, detail]) => (
                    <div key={title} className="rounded-2xl border border-[#2ECC71]/20 bg-[#0B3C5D]/40 p-4">
                      <Lightbulb className="mb-3 h-5 w-5 text-[#8ff0b4]" />
                      <h3 className="font-semibold text-white">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-400">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#2ECC71]/20 bg-[#0B3C5D]/60 p-5 shadow-2xl shadow-[#2ECC71]/10">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Verbesserung vorschlagen</h3>
                    <p className="mt-1 text-sm text-gray-400">
                      Öffentlich sichtbar, aber Absenden mit Login, damit wir Rückfragen stellen können.
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#2ECC71]/10 p-3 text-[#8ff0b4]">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm text-gray-300">Kategorie</span>
                    <select
                      value={feedbackForm.category}
                      onChange={(event) => updateFeedbackForm('category', event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#2ECC71]/60"
                    >
                      {FEEDBACK_CATEGORIES.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-gray-300">Rolle oder Kontext</span>
                    <input
                      value={feedbackForm.roleContext}
                      onChange={(event) => updateFeedbackForm('roleContext', event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-[#06121C]/70 px-4 text-white outline-none transition focus:border-[#2ECC71]/60"
                      placeholder="z.B. Verlader, Fahrer, Spedition"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-sm text-gray-300">Was sollen wir verbessern?</span>
                  <textarea
                    value={feedbackForm.message}
                    onChange={(event) => updateFeedbackForm('message', event.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#06121C]/70 px-4 py-3 text-white outline-none transition focus:border-[#2ECC71]/60"
                    placeholder="Beschreibe kurz, was fehlt, wo etwas unklar ist oder welcher Ablauf einfacher werden sollte."
                  />
                </label>

                <Button
                  className="mt-5 h-12 w-full gap-2 bg-gradient-to-r from-[#1C7ED6] to-[#2ECC71] hover:opacity-90"
                  onClick={() => void submitFeedback()}
                  disabled={feedbackSubmitting}
                >
                  {feedbackSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Vorschlag senden
                </Button>

                <p className="mt-3 text-xs leading-5 text-gray-500">
                  Feedback wird intern als Produkt-Feedback-Ticket gespeichert. Kritische Supportfälle oder Streitfälle bitte weiterhin über die jeweilige Auftragsansicht melden.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-24 bg-[#06121C] relative overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 opacity-30">
            <Image
              src="/images/dashboard-main.png"
              alt="Truck on highway"
              fill
              className="object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#06121C] via-[#06121C]/80 to-[#06121C]/60" />
          
          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Bereit, smarter zu transportieren?
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              Werde jetzt Teil von CargoBit und profitiere von unserer starken Community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gap-2 px-8 h-14 text-lg bg-[#1C7ED6] hover:bg-[#1C7ED6]/80"
                onClick={() => { setAuthTab('register'); setShowAuthModal(true); }}
              >
                Jetzt registrieren
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2 px-8 h-14 text-lg border-gray-600 text-gray-300 hover:bg-white/10"
                onClick={() => scrollToSection('features')}
              >
                Mehr erfahren
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-[#0B3C5D]/50 border-t border-[#1C7ED6]/20 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
              {/* Logo and Description */}
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-xl font-bold text-white">CargoBit</span>
                    <p className="text-xs text-[#00D4FF]">Transporte in Europa</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  CargoBit ist die smarte Plattform für Transporte in ganz Europa.
                </p>
                <div className="flex gap-3">
                  <a href="#" className="w-8 h-8 rounded-lg bg-[#1C7ED6]/20 flex items-center justify-center hover:bg-[#1C7ED6]/30 transition-colors">
                    <Facebook className="w-4 h-4 text-[#00D4FF]" />
                  </a>
                  <a href="#" className="w-8 h-8 rounded-lg bg-[#1C7ED6]/20 flex items-center justify-center hover:bg-[#1C7ED6]/30 transition-colors">
                    <Linkedin className="w-4 h-4 text-[#00D4FF]" />
                  </a>
                  <a href="#" className="w-8 h-8 rounded-lg bg-[#1C7ED6]/20 flex items-center justify-center hover:bg-[#1C7ED6]/30 transition-colors">
                    <Instagram className="w-4 h-4 text-[#00D4FF]" />
                  </a>
                  <a href="#" className="w-8 h-8 rounded-lg bg-[#1C7ED6]/20 flex items-center justify-center hover:bg-[#1C7ED6]/30 transition-colors">
                    <Youtube className="w-4 h-4 text-[#00D4FF]" />
                  </a>
                </div>
              </div>

              {/* Plattform */}
              <div>
                <h4 className="font-semibold text-white mb-4">Plattform</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Matching</a></li>
                  <li><a href="#preise" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Preise</a></li>
                  <li><a href="/zahlungsschutz" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Zahlungsschutz</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Live Tracking</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Dokumente</a></li>
                </ul>
              </div>

              {/* Unternehmen */}
              <div>
                <h4 className="font-semibold text-white mb-4">Unternehmen</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Über uns</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Karriere</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Presse</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Blog</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Kontakt</a></li>
                </ul>
              </div>

              {/* Rechtliches */}
              <div>
                <h4 className="font-semibold text-white mb-4">Rechtliches</h4>
                <ul className="space-y-2">
                  <li><a href="/agb" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">AGB</a></li>
                  <li><a href="/datenschutz" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Datenschutz</a></li>
                  <li><a href="/impressum" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Impressum</a></li>
                  <li><a href="/widerruf" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Widerruf</a></li>
                  <li><a href="/vermittlung-haftung" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Vermittlung & Haftung</a></li>
                  <li><a href="/versicherung-partner" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Versicherung & Partner</a></li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h4 className="font-semibold text-white mb-4">Support</h4>
                <ul className="space-y-2">
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Hilfe-Center</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Support anfragen</a></li>
                  <li><a href="#verbesserungen" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Verbesserungen</a></li>
                  <li><a href="#" className="text-sm text-gray-400 hover:text-[#00D4FF] transition-colors">Status</a></li>
                </ul>
              </div>
            </div>

            {/* Copyright */}
            <div className="mt-12 pt-8 border-t border-[#1C7ED6]/20 text-center">
              <p className="text-sm text-gray-500">© 2024 CargoBit. Alle Rechte vorbehalten.</p>
            </div>
          </div>
        </footer>
      </div>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultTab={authTab}
      />
    </>
  );
}
