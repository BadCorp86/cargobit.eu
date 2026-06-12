'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowRight,
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  Calendar,
  Scale,
  Ruler,
  Thermometer,
  AlertTriangle,
  Car,
  Container,
  Droplets,
  Bot,
  Info,
  Check,
  Loader2,
  Shield,
  ExternalLink,
} from 'lucide-react';
import {
  CARGO_TYPE_CONFIGS,
  CONTAINER_VOLUME_M3,
  LIQUID_UNIT_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  getCargoTypeConfig,
  type CargoTransportType,
} from '@/lib/cargo-types';

interface TransportFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: TransportFormSubmitPayload) => Promise<boolean | void> | boolean | void;
  initialData?: TransportFormInitialData | null;
}

type TransportType = CargoTransportType;

export type TransportFormInitialData = Partial<{
  pickupCity: string;
  pickupPostalCode: string;
  pickupCountry: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryCountry: string;
  description: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  cargoValue: string;
  hazmat: boolean;
  budget: string;
  aiSuggestedPrice: number;
  transportType: TransportType;
  bulkMaterial: string;
  bulkVolume: string;
  bulkDensity: string;
  liquidProduct: string;
  liquidAmount: string;
  liquidAmountUnit: 'liter' | 'm3';
  liquidContainerType: string;
  vehicleSubtype: string;
  vehicleLengthM: string;
  vehicleWidthM: string;
  vehicleHeightM: string;
  vehicleWeightKg: string;
  carCount: string;
  carCondition: string;
  oversizeLength: string;
  oversizeWidth: string;
  oversizeHeight: string;
  lowloaderCargoLength: string;
  lowloaderCargoWidth: string;
  lowloaderCargoHeight: string;
  lowloaderCargoWeight: string;
}>;

export type TransportFormSubmitPayload = {
  pickupAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  deliveryAddress: {
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  pickupDatetime: string;
  pickupTimeFrom?: string;
  pickupTimeTo?: string;
  deliveryDatetime?: string;
  deliveryTimeFrom?: string;
  deliveryTimeTo?: string;
  description?: string;
  weightKg: number;
  volumeM3?: number;
  transportType: TransportType;
  cargoDetails: Record<string, unknown>;
  shipperBudget: number;
  currency: string;
  isInternational: boolean;
  specialRequirements?: string;
  insuranceReferral?: {
    requested: boolean;
    cargoValueEur?: number;
    pickupCity: string;
    pickupCountry: string;
    deliveryCity: string;
    deliveryCountry: string;
    consentAccepted: boolean;
  };
};

const transportTypeIcons: Record<TransportType, React.ReactNode> = {
  pallet: <Package className="w-5 h-5" />,
  bulk: <Scale className="w-5 h-5" />,
  liquid: <Droplets className="w-5 h-5" />,
  oversize: <Truck className="w-5 h-5" />,
  lowloader: <Truck className="w-5 h-5" />,
  car_transport: <Car className="w-5 h-5" />,
  cooling: <Thermometer className="w-5 h-5" />,
  hazmat: <AlertTriangle className="w-5 h-5" />,
  container: <Container className="w-5 h-5" />,
};

const transportTypes = CARGO_TYPE_CONFIGS.map((config) => ({
  value: config.value,
  label: config.label,
  description: config.description,
  icon: transportTypeIcons[config.value],
}));

interface PricingQuote {
  recommendedPrice: number;
  marketPrice: number;
  minPrice: number;
  currency: string;
  confidence: number;
  modelVersion: string;
  source: string;
  route: {
    distanceKm: number;
    durationMinutes: number;
    tollCost: number;
  };
}

interface InsuranceReferralQuote {
  mode: 'partner_lead';
  leadId: string | null;
  provider: string;
  product: string;
  premiumEstimateEur: number;
  coverageEstimateEur: number;
  deductibleEur: number;
  commission: {
    type: string;
    rate: number;
    estimateEur: number;
  };
  referralUrl: string;
  validUntil: string;
  complianceNotice: string;
}

function formatCurrency(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function parseNumber(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function calculateVolumeM3(formData: {
  length: string;
  width: string;
  height: string;
  bulkVolume: string;
  liquidAmount: string;
  liquidAmountUnit: 'liter' | 'm3';
  oversizeLength: string;
  oversizeWidth: string;
  oversizeHeight: string;
  lowloaderCargoLength: string;
  lowloaderCargoWidth: string;
  lowloaderCargoHeight: string;
  vehicleLengthM: string;
  vehicleWidthM: string;
  vehicleHeightM: string;
  carCount: string;
  containerType: string;
}, transportType: TransportType) {
  if (transportType === 'bulk') {
    return parseNumber(formData.bulkVolume);
  }

  if (transportType === 'liquid') {
    const liquidAmount = parseNumber(formData.liquidAmount);
    if (!liquidAmount) return undefined;
    return formData.liquidAmountUnit === 'm3'
      ? liquidAmount
      : Math.round((liquidAmount / 1000) * 100) / 100;
  }

  if (transportType === 'car_transport') {
    const lengthM = parseNumber(formData.vehicleLengthM);
    const widthM = parseNumber(formData.vehicleWidthM);
    const heightM = parseNumber(formData.vehicleHeightM);
    const count = parseNumber(formData.carCount) || 1;
    if (lengthM && widthM && heightM) {
      return Math.round((lengthM * widthM * heightM * count) * 100) / 100;
    }
  }

  if (transportType === 'oversize') {
    const lengthM = parseNumber(formData.oversizeLength);
    const widthM = parseNumber(formData.oversizeWidth);
    const heightM = parseNumber(formData.oversizeHeight);
    if (lengthM && widthM && heightM) {
      return Math.round((lengthM * widthM * heightM) * 100) / 100;
    }
  }

  if (transportType === 'lowloader') {
    const lengthM = parseNumber(formData.lowloaderCargoLength);
    const widthM = parseNumber(formData.lowloaderCargoWidth);
    const heightM = parseNumber(formData.lowloaderCargoHeight);
    if (lengthM && widthM && heightM) {
      return Math.round((lengthM * widthM * heightM) * 100) / 100;
    }
  }

  if (transportType === 'container' && formData.containerType) {
    return CONTAINER_VOLUME_M3[formData.containerType];
  }

  const lengthCm = parseNumber(formData.length);
  const widthCm = parseNumber(formData.width);
  const heightCm = parseNumber(formData.height);

  if (lengthCm && widthCm && heightCm) {
    return Math.round((lengthCm * widthCm * heightCm / 1_000_000) * 100) / 100;
  }

  return undefined;
}

function calculateWeightKg(formData: {
  weight: string;
  containerWeight: string;
  lowloaderCargoWeight: string;
  vehicleWeightKg: string;
  bulkVolume: string;
  bulkDensity: string;
  liquidAmount: string;
  liquidAmountUnit: 'liter' | 'm3';
}, transportType: TransportType) {
  if (transportType === 'car_transport') {
    return parseNumber(formData.vehicleWeightKg) || parseNumber(formData.weight) || 1500;
  }

  if (transportType === 'container') {
    return parseNumber(formData.containerWeight) || parseNumber(formData.weight) || 10_000;
  }

  if (transportType === 'lowloader') {
    return parseNumber(formData.lowloaderCargoWeight) || parseNumber(formData.weight) || 10_000;
  }

  if (transportType === 'bulk') {
    const enteredWeight = parseNumber(formData.weight);
    const volume = parseNumber(formData.bulkVolume);
    const density = parseNumber(formData.bulkDensity);
    if (enteredWeight) return enteredWeight;
    if (volume && density) return Math.round(volume * density);
    return 1000;
  }

  if (transportType === 'liquid') {
    const enteredWeight = parseNumber(formData.weight);
    const amount = parseNumber(formData.liquidAmount);
    if (enteredWeight) return enteredWeight;
    if (!amount) return 1000;
    return formData.liquidAmountUnit === 'm3' ? Math.round(amount * 1000) : Math.round(amount);
  }

  return parseNumber(formData.weight) || 500;
}

export function TransportForm({ open, onOpenChange, onSubmit, initialData }: TransportFormProps) {
  const [step, setStep] = useState(1);
  const [transportType, setTransportType] = useState<TransportType>('pallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAiPrice, setShowAiPrice] = useState(true);
  const [pricingQuote, setPricingQuote] = useState<PricingQuote | null>(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [insuranceQuote, setInsuranceQuote] = useState<InsuranceReferralQuote | null>(null);
  const [isInsuranceLoading, setIsInsuranceLoading] = useState(false);
  const [insuranceError, setInsuranceError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    // Pickup/Delivery
    pickupAddress: '',
    pickupCity: '',
    pickupPostalCode: '',
    pickupCountry: 'Deutschland',
    pickupDate: '',
    pickupTimeFrom: '',
    pickupTimeTo: '',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryPostalCode: '',
    deliveryCountry: 'Deutschland',
    deliveryDate: '',
    deliveryTimeFrom: '',
    deliveryTimeTo: '',
    
    // Cargo details
    description: '',
    weight: '',
    length: '',
    width: '',
    height: '',
    stackable: false,
    hazmat: false,
    cargoValue: '',
    insuranceRequested: false,
    insuranceConsent: false,
    
    // Type-specific fields
    palletCount: '',
    palletType: 'europalette',
    loadingEquipment: '',
    unloadingMethod: '',
    
    bulkMaterial: '',
    bulkVolume: '',
    bulkDensity: '',
    loadingMethod: '',
    unloadingMethodBulk: '',
    
    liquidProduct: '',
    liquidAmount: '',
    liquidAmountUnit: 'liter' as 'liter' | 'm3',
    liquidContainerType: '',
    
    oversizeLength: '',
    oversizeWidth: '',
    oversizeHeight: '',
    oversizePermits: false,
    escortVehicle: false,
    
    lowloaderCargoHeight: '',
    lowloaderCargoLength: '',
    lowloaderCargoWidth: '',
    lowloaderCargoWeight: '',
    lowloaderRamp: false,
    
    carCount: '',
    carTypes: '',
    vehicleSubtype: 'suv',
    vehicleLengthM: '',
    vehicleWidthM: '',
    vehicleHeightM: '',
    vehicleWeightKg: '',
    carCondition: 'fahrbereit',
    
    coolingMinTemp: '',
    coolingMaxTemp: '',
    coolingPreCooled: false,
    
    hazmatUN: '',
    hazmatClass: '',
    hazmatPackingGroup: '',
    
    containerType: '',
    containerWeight: '',
    containerSeal: '',
    
    // Pricing
    budget: '',
    aiSuggestedPrice: 450,
  });

  const quoteWeightKg = useMemo(() => {
    return calculateWeightKg(formData, transportType);
  }, [formData, transportType]);

  const quoteVolumeM3 = useMemo(() => calculateVolumeM3(formData, transportType), [formData, transportType]);
  const cargoTypeConfig = getCargoTypeConfig(transportType);

  const recommendedPrice = pricingQuote?.recommendedPrice || formData.aiSuggestedPrice;
  const pricingCurrency = pricingQuote?.currency || 'EUR';
  const canRequestPricing = Boolean(formData.pickupCity && formData.deliveryCity && quoteWeightKg);
  const canRequestInsurance = Boolean(formData.insuranceRequested && parseNumber(formData.cargoValue));
  const cargoDetails = useMemo(() => ({
    transportType,
    label: cargoTypeConfig.label,
    measurementMode: cargoTypeConfig.measurementMode,
    normalized: {
      weightKg: quoteWeightKg,
      volumeM3: quoteVolumeM3,
    },
    pallet: {
      count: formData.palletCount,
      type: formData.palletType,
      stackable: formData.stackable,
    },
    bulk: {
      material: formData.bulkMaterial,
      volumeM3: formData.bulkVolume,
      densityKgM3: formData.bulkDensity,
    },
    liquid: {
      product: formData.liquidProduct,
      amount: formData.liquidAmount,
      unit: formData.liquidAmountUnit,
      containerType: formData.liquidContainerType,
    },
    vehicle: {
      subtype: formData.vehicleSubtype,
      typeText: formData.carTypes,
      count: formData.carCount,
      condition: formData.carCondition,
      lengthM: formData.vehicleLengthM,
      widthM: formData.vehicleWidthM,
      heightM: formData.vehicleHeightM,
      weightKg: formData.vehicleWeightKg,
    },
    oversize: {
      lengthM: formData.oversizeLength,
      widthM: formData.oversizeWidth,
      heightM: formData.oversizeHeight,
      permitsRequired: formData.oversizePermits,
      escortVehicle: formData.escortVehicle,
    },
    lowloader: {
      lengthM: formData.lowloaderCargoLength,
      widthM: formData.lowloaderCargoWidth,
      heightM: formData.lowloaderCargoHeight,
      weightKg: formData.lowloaderCargoWeight,
      rampRequired: formData.lowloaderRamp,
    },
    container: {
      type: formData.containerType,
      grossWeightKg: formData.containerWeight,
      seal: formData.containerSeal,
    },
    cooling: {
      minTempC: formData.coolingMinTemp,
      maxTempC: formData.coolingMaxTemp,
      preCooled: formData.coolingPreCooled,
    },
    hazmat: {
      unNumber: formData.hazmatUN,
      class: formData.hazmatClass,
      packingGroup: formData.hazmatPackingGroup,
    },
  }), [cargoTypeConfig.label, cargoTypeConfig.measurementMode, formData, quoteVolumeM3, quoteWeightKg, transportType]);
  const cargoSummaryLine = useMemo(() => {
    const weightLabel = `${Math.round(quoteWeightKg).toLocaleString('de-DE')} kg`;
    const volumeLabel = quoteVolumeM3 ? `${quoteVolumeM3.toLocaleString('de-DE')} m³` : null;

    if (transportType === 'car_transport') {
      const vehicleLabel = VEHICLE_TYPE_OPTIONS.find((option) => option.value === formData.vehicleSubtype)?.label || 'Fahrzeug';
      const dimensions = [formData.vehicleLengthM, formData.vehicleWidthM, formData.vehicleHeightM].filter(Boolean).join(' × ');
      return [vehicleLabel, formData.carCount ? `${formData.carCount} Fahrzeug(e)` : null, dimensions ? `${dimensions} m` : null, weightLabel].filter(Boolean).join(' • ');
    }

    if (transportType === 'liquid') {
      const amount = formData.liquidAmount
        ? `${Number(formData.liquidAmount).toLocaleString('de-DE')} ${formData.liquidAmountUnit === 'm3' ? 'm³' : 'Liter'}`
        : 'Menge offen';
      return [formData.liquidProduct || 'Flüssigkeit', amount, volumeLabel, weightLabel].filter(Boolean).join(' • ');
    }

    if (transportType === 'bulk') {
      return [formData.bulkMaterial || 'Schüttgut', volumeLabel, formData.bulkDensity ? `${formData.bulkDensity} kg/m³` : null, weightLabel].filter(Boolean).join(' • ');
    }

    if (transportType === 'container') {
      return [formData.containerType || 'Container', weightLabel, volumeLabel].filter(Boolean).join(' • ');
    }

    if (transportType === 'oversize') {
      const dimensions = [formData.oversizeLength, formData.oversizeWidth, formData.oversizeHeight].filter(Boolean).join(' × ');
      return [dimensions ? `${dimensions} m` : null, weightLabel, formData.escortVehicle ? 'Begleitfahrzeug' : null].filter(Boolean).join(' • ');
    }

    if (transportType === 'lowloader') {
      const dimensions = [formData.lowloaderCargoLength, formData.lowloaderCargoWidth, formData.lowloaderCargoHeight].filter(Boolean).join(' × ');
      return [dimensions ? `${dimensions} m` : null, weightLabel, formData.lowloaderRamp ? 'Rampe erforderlich' : null].filter(Boolean).join(' • ');
    }

    const dimensions = [formData.length, formData.width, formData.height].filter(Boolean).join(' × ');
    return [weightLabel, dimensions ? `${dimensions} cm` : null, volumeLabel].filter(Boolean).join(' • ');
  }, [formData, quoteVolumeM3, quoteWeightKg, transportType]);

  const steps = [
    { number: 1, title: 'Transportart' },
    { number: 2, title: 'Abholung & Lieferung' },
    { number: 3, title: 'Frachtdetails' },
    { number: 4, title: 'Preis' },
    { number: 5, title: 'Überprüfung' },
  ];

  const handleNext = () => setStep(step + 1);
  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    setSubmitError(null);

    if (!formData.pickupCity || !formData.deliveryCity) {
      setSubmitError('Bitte Abholort und Zielort eingeben.');
      setStep(2);
      return;
    }

    if (!formData.pickupDate) {
      setSubmitError('Bitte ein Abholdatum eingeben.');
      setStep(2);
      return;
    }

    if (!recommendedPrice || recommendedPrice <= 0) {
      setSubmitError('Bitte zuerst einen KI-Preis oder ein Budget berechnen.');
      setStep(4);
      return;
    }

    const pickupDatetime = new Date(`${formData.pickupDate}T${formData.pickupTimeFrom || '08:00'}`).toISOString();
    const deliveryDatetime = formData.deliveryDate
      ? new Date(`${formData.deliveryDate}T${formData.deliveryTimeFrom || '17:00'}`).toISOString()
      : undefined;
    const shipperBudget = Number(formData.budget) > 0 ? Number(formData.budget) : Math.round(recommendedPrice);

    const payload: TransportFormSubmitPayload = {
      pickupAddress: {
        street: formData.pickupAddress || formData.pickupCity,
        postalCode: formData.pickupPostalCode,
        city: formData.pickupCity,
        country: formData.pickupCountry,
      },
      deliveryAddress: {
        street: formData.deliveryAddress || formData.deliveryCity,
        postalCode: formData.deliveryPostalCode,
        city: formData.deliveryCity,
        country: formData.deliveryCountry,
      },
      pickupDatetime,
      pickupTimeFrom: formData.pickupTimeFrom,
      pickupTimeTo: formData.pickupTimeTo,
      deliveryDatetime,
      deliveryTimeFrom: formData.deliveryTimeFrom,
      deliveryTimeTo: formData.deliveryTimeTo,
      description: formData.description,
      weightKg: quoteWeightKg,
      volumeM3: quoteVolumeM3,
      transportType,
      cargoDetails,
      shipperBudget,
      currency: pricingCurrency,
      isInternational: formData.pickupCountry !== formData.deliveryCountry,
      specialRequirements: cargoSummaryLine,
      insuranceReferral: formData.insuranceRequested
        ? {
            requested: true,
            cargoValueEur: parseNumber(formData.cargoValue),
            pickupCity: formData.pickupCity,
            pickupCountry: formData.pickupCountry,
            deliveryCity: formData.deliveryCity,
            deliveryCountry: formData.deliveryCountry,
            consentAccepted: formData.insuranceConsent,
          }
        : undefined,
    };

    setIsSubmitting(true);
    try {
      const shouldReset = await onSubmit(payload);
      if (shouldReset !== false) {
        setStep(1);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Auftrag konnte nicht erstellt werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (!open || !initialData) return;

    const { transportType: nextTransportType, ...nextFormData } = initialData;
    if (nextTransportType) {
      setTransportType(nextTransportType);
    }

    setFormData((prev) => ({
      ...prev,
      ...nextFormData,
      budget: nextFormData.budget || prev.budget,
      aiSuggestedPrice: nextFormData.aiSuggestedPrice || prev.aiSuggestedPrice,
    }));
    setStep(4);
  }, [initialData, open]);

  useEffect(() => {
    if (!open || step < 4 || !showAiPrice || !canRequestPricing) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsPricingLoading(true);
      setPricingError(null);

      try {
        const response = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            pickup: {
              address: formData.pickupAddress,
              city: formData.pickupCity,
              postalCode: formData.pickupPostalCode,
              country: formData.pickupCountry,
            },
            delivery: {
              address: formData.deliveryAddress,
              city: formData.deliveryCity,
              postalCode: formData.deliveryPostalCode,
              country: formData.deliveryCountry,
            },
            weightKg: quoteWeightKg,
            volumeM3: quoteVolumeM3,
            transportType,
            cargoDetails,
            isInternational: formData.pickupCountry !== formData.deliveryCountry,
            isHazmat: formData.hazmat || transportType === 'hazmat',
            requiresCooling: transportType === 'cooling',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || 'Preisempfehlung nicht verfügbar');
        }

        setPricingQuote(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPricingError(error instanceof Error ? error.message : 'Preisempfehlung nicht verfügbar');
      } finally {
        if (!controller.signal.aborted) {
          setIsPricingLoading(false);
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    canRequestPricing,
    cargoDetails,
    formData.deliveryAddress,
    formData.deliveryCity,
    formData.deliveryCountry,
    formData.deliveryPostalCode,
    formData.hazmat,
    formData.pickupAddress,
    formData.pickupCity,
    formData.pickupCountry,
    formData.pickupPostalCode,
    open,
    quoteVolumeM3,
    quoteWeightKg,
    showAiPrice,
    step,
    transportType,
  ]);

  useEffect(() => {
    if (!open || step < 4 || !canRequestInsurance) {
      setInsuranceQuote(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsInsuranceLoading(true);
      setInsuranceError(null);

      try {
        const response = await fetch('/api/insurance/referral/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            requestedByRole: 'SHIPPER',
            source: 'SHIPPER_CREATE',
            cargoDescription: formData.description,
            cargoValueEur: parseNumber(formData.cargoValue),
            weightKg: quoteWeightKg,
            pickupCity: formData.pickupCity,
            pickupCountry: formData.pickupCountry,
            deliveryCity: formData.deliveryCity,
            deliveryCountry: formData.deliveryCountry,
            consentAccepted: formData.insuranceConsent,
            persistLead: false,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || 'Versicherungsangebot nicht verfügbar');
        }

        setInsuranceQuote(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setInsuranceError(error instanceof Error ? error.message : 'Versicherungsangebot nicht verfügbar');
      } finally {
        if (!controller.signal.aborted) {
          setIsInsuranceLoading(false);
        }
      }
    }, 450);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    canRequestInsurance,
    formData.cargoValue,
    formData.deliveryCity,
    formData.deliveryCountry,
    formData.description,
    formData.insuranceConsent,
    formData.pickupCity,
    formData.pickupCountry,
    open,
    quoteWeightKg,
    step,
  ]);

  const createInsuranceLead = async () => {
    if (!canRequestInsurance || !formData.insuranceConsent) {
      setInsuranceError('Bitte Warenwert eingeben und die externe Weiterleitung bestätigen.');
      return;
    }

    setIsInsuranceLoading(true);
    setInsuranceError(null);

    try {
      const response = await fetch('/api/insurance/referral/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedByRole: 'SHIPPER',
          source: 'SHIPPER_CREATE',
          cargoDescription: formData.description,
          cargoValueEur: parseNumber(formData.cargoValue),
          weightKg: quoteWeightKg,
          pickupCity: formData.pickupCity,
          pickupCountry: formData.pickupCountry,
          deliveryCity: formData.deliveryCity,
          deliveryCountry: formData.deliveryCountry,
          consentAccepted: formData.insuranceConsent,
          persistLead: true,
          markRedirected: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Versicherungs-Lead konnte nicht erstellt werden.');
      setInsuranceQuote(data);
      window.open(data.referralUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setInsuranceError(error instanceof Error ? error.message : 'Versicherungs-Lead konnte nicht erstellt werden.');
    } finally {
      setIsInsuranceLoading(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (transportType) {
      case 'pallet':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Anzahl Paletten</Label>
                <Input
                  type="number"
                  value={formData.palletCount}
                  onChange={(e) => updateFormData('palletCount', e.target.value)}
                  placeholder="z.B. 5"
                />
              </div>
              <div className="space-y-2">
                <Label>Palettenart</Label>
                <Select value={formData.palletType} onValueChange={(v) => updateFormData('palletType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="europalette">Europalette</SelectItem>
                    <SelectItem value="industriepalette">Industriepalette</SelectItem>
                    <SelectItem value="einwegpalette">Einwegpalette</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.stackable}
                onCheckedChange={(v) => updateFormData('stackable', v)}
              />
              <Label>Stapelbar</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ladehilfsmittel</Label>
                <Select value={formData.loadingEquipment} onValueChange={(v) => updateFormData('loadingEquipment', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="folie">Folie</SelectItem>
                    <SelectItem value="umreifung">Umreifung</SelectItem>
                    <SelectItem value="kantenschutz">Kantenschutz</SelectItem>
                    <SelectItem value="none">Keine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entladung</Label>
                <Select value={formData.unloadingMethod} onValueChange={(v) => updateFormData('unloadingMethod', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gabelstapler">Gabelstapler</SelectItem>
                    <SelectItem value="ladebordwand">Ladebordwand</SelectItem>
                    <SelectItem value="manuell">Manuell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'bulk':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Material</Label>
                <Input
                  value={formData.bulkMaterial}
                  onChange={(e) => updateFormData('bulkMaterial', e.target.value)}
                  placeholder="z.B. Sand, Kies, Getreide"
                />
              </div>
              <div className="space-y-2">
                <Label>Volumen (m³)</Label>
                <Input
                  type="number"
                  value={formData.bulkVolume}
                  onChange={(e) => updateFormData('bulkVolume', e.target.value)}
                  placeholder="z.B. 25"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Schüttdichte (kg/m³)</Label>
              <Input
                type="number"
                value={formData.bulkDensity}
                onChange={(e) => updateFormData('bulkDensity', e.target.value)}
                placeholder="z.B. 1600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Beladung</Label>
                <Select value={formData.loadingMethod} onValueChange={(v) => updateFormData('loadingMethod', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="silo">Silo</SelectItem>
                    <SelectItem value="foerderband">Förderband</SelectItem>
                    <SelectItem value="schaufel">Schaufel</SelectItem>
                    <SelectItem value="radlader">Radlader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Entladung</Label>
                <Select value={formData.unloadingMethodBulk} onValueChange={(v) => updateFormData('unloadingMethodBulk', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kippen_hinten">Kippen hinten</SelectItem>
                    <SelectItem value="kippen_seite">Kippen seitlich</SelectItem>
                    <SelectItem value="absaugen">Absaugen</SelectItem>
                    <SelectItem value="bodenentleerung">Bodenentleerung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'cooling':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min. Temperatur (°C)</Label>
                <Input
                  type="number"
                  value={formData.coolingMinTemp}
                  onChange={(e) => updateFormData('coolingMinTemp', e.target.value)}
                  placeholder="z.B. 2"
                />
              </div>
              <div className="space-y-2">
                <Label>Max. Temperatur (°C)</Label>
                <Input
                  type="number"
                  value={formData.coolingMaxTemp}
                  onChange={(e) => updateFormData('coolingMaxTemp', e.target.value)}
                  placeholder="z.B. 8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.coolingPreCooled}
                onCheckedChange={(v) => updateFormData('coolingPreCooled', v)}
              />
              <Label>Vorgekühlt</Label>
            </div>
          </div>
        );

      case 'hazmat':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Gefahrgut-Transport</div>
                <div className="text-muted-foreground">
                  Nur verifizierte Fahrer mit ADR-Schein können diesen Transport übernehmen.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>UN-Nummer</Label>
                <Input
                  value={formData.hazmatUN}
                  onChange={(e) => updateFormData('hazmatUN', e.target.value)}
                  placeholder="z.B. UN1203"
                />
              </div>
              <div className="space-y-2">
                <Label>Gefahrgutklasse</Label>
                <Input
                  value={formData.hazmatClass}
                  onChange={(e) => updateFormData('hazmatClass', e.target.value)}
                  placeholder="z.B. 3"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Verpackungsgruppe</Label>
              <Select value={formData.hazmatPackingGroup} onValueChange={(v) => updateFormData('hazmatPackingGroup', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="I">I - Hohe Gefahr</SelectItem>
                  <SelectItem value="II">II - Mittlere Gefahr</SelectItem>
                  <SelectItem value="III">III - Geringe Gefahr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'car_transport':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Fahrzeugtransport</div>
                <div className="text-muted-foreground">
                  Wähle den Fahrzeugtyp und trage Maße in Metern ein. Das hilft bei Rampe, Anhänger, Versicherung und Preis.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Anzahl Fahrzeuge</Label>
                <Input
                  type="number"
                  value={formData.carCount}
                  onChange={(e) => updateFormData('carCount', e.target.value)}
                  placeholder="z.B. 3"
                />
              </div>
              <div className="space-y-2">
                <Label>Fahrzeugtyp</Label>
                <Select value={formData.vehicleSubtype} onValueChange={(v) => updateFormData('vehicleSubtype', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modell / Beschreibung optional</Label>
              <Input
                value={formData.carTypes}
                onChange={(e) => updateFormData('carTypes', e.target.value)}
                placeholder={VEHICLE_TYPE_OPTIONS.find((option) => option.value === formData.vehicleSubtype)?.example || 'z.B. BMW X5'}
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Länge (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.vehicleLengthM}
                  onChange={(e) => updateFormData('vehicleLengthM', e.target.value)}
                  placeholder="4.8"
                />
              </div>
              <div className="space-y-2">
                <Label>Breite (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.vehicleWidthM}
                  onChange={(e) => updateFormData('vehicleWidthM', e.target.value)}
                  placeholder="1.9"
                />
              </div>
              <div className="space-y-2">
                <Label>Höhe (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.vehicleHeightM}
                  onChange={(e) => updateFormData('vehicleHeightM', e.target.value)}
                  placeholder="1.7"
                />
              </div>
              <div className="space-y-2">
                <Label>Gewicht (kg)</Label>
                <Input
                  type="number"
                  value={formData.vehicleWeightKg}
                  onChange={(e) => updateFormData('vehicleWeightKg', e.target.value)}
                  placeholder="2100"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fahrzustand</Label>
              <Select value={formData.carCondition} onValueChange={(v) => updateFormData('carCondition', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fahrbereit">Fahrbereit</SelectItem>
                  <SelectItem value="nicht_fahrbereit">Nicht fahrbereit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'container':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Containertyp</Label>
                <Select value={formData.containerType} onValueChange={(v) => updateFormData('containerType', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20ft">20ft Standard</SelectItem>
                    <SelectItem value="40ft">40ft Standard</SelectItem>
                    <SelectItem value="45ft">45ft Standard</SelectItem>
                    <SelectItem value="reefer">Kühlcontainer</SelectItem>
                    <SelectItem value="tank">Tankcontainer</SelectItem>
                    <SelectItem value="open_top">Open Top</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bruttogewicht (kg)</Label>
                <Input
                  type="number"
                  value={formData.containerWeight}
                  onChange={(e) => updateFormData('containerWeight', e.target.value)}
                  placeholder="z.B. 24000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plombennummer (optional)</Label>
              <Input
                value={formData.containerSeal}
                onChange={(e) => updateFormData('containerSeal', e.target.value)}
                placeholder="z.B. 123456"
              />
            </div>
          </div>
        );

      case 'liquid':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Produkt</Label>
                <Input
                  value={formData.liquidProduct}
                  onChange={(e) => updateFormData('liquidProduct', e.target.value)}
                  placeholder="z.B. Wasserstoffperoxid"
                />
              </div>
              <div className="space-y-2">
                <Label>Menge</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.liquidAmount}
                    onChange={(e) => updateFormData('liquidAmount', e.target.value)}
                    placeholder="z.B. 25000"
                  />
                  <Select value={formData.liquidAmountUnit} onValueChange={(v) => updateFormData('liquidAmountUnit', v)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIQUID_UNIT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Behälterart</Label>
              <Select value={formData.liquidContainerType} onValueChange={(v) => updateFormData('liquidContainerType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tankauflieger">Tankauflieger</SelectItem>
                  <SelectItem value="ibc">IBC</SelectItem>
                  <SelectItem value="fass">Fass</SelectItem>
                  <SelectItem value="tankcontainer">Tankcontainer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'oversize':
        return (
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium">Überlänge-Transport</div>
                <div className="text-muted-foreground">
                  Sondergenehmigungen können erforderlich sein. Preis enthält ggf. zusätzliche Kosten.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Länge (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.oversizeLength}
                  onChange={(e) => updateFormData('oversizeLength', e.target.value)}
                  placeholder="z.B. 18.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Breite (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.oversizeWidth}
                  onChange={(e) => updateFormData('oversizeWidth', e.target.value)}
                  placeholder="z.B. 3.2"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Höhe (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.oversizeHeight}
                  onChange={(e) => updateFormData('oversizeHeight', e.target.value)}
                  placeholder="z.B. 4.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Gewicht (kg)</Label>
                <Input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => updateFormData('weight', e.target.value)}
                  placeholder="z.B. 35000"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.oversizePermits}
                  onCheckedChange={(v) => updateFormData('oversizePermits', v)}
                />
                <Label>Sondergenehmigungen erforderlich</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.escortVehicle}
                  onCheckedChange={(v) => updateFormData('escortVehicle', v)}
                />
                <Label>Begleitfahrzeug erforderlich</Label>
              </div>
            </div>
          </div>
        );

      case 'lowloader':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ladungslänge (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.lowloaderCargoLength}
                  onChange={(e) => updateFormData('lowloaderCargoLength', e.target.value)}
                  placeholder="z.B. 8.0"
                />
              </div>
              <div className="space-y-2">
                <Label>Ladungsbreite (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.lowloaderCargoWidth}
                  onChange={(e) => updateFormData('lowloaderCargoWidth', e.target.value)}
                  placeholder="z.B. 2.8"
                />
              </div>
              <div className="space-y-2">
                <Label>Ladungshöhe (m)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.lowloaderCargoHeight}
                  onChange={(e) => updateFormData('lowloaderCargoHeight', e.target.value)}
                  placeholder="z.B. 3.5"
                />
              </div>
              <div className="space-y-2">
                <Label>Ladungsgewicht (kg)</Label>
                <Input
                  type="number"
                  value={formData.lowloaderCargoWeight}
                  onChange={(e) => updateFormData('lowloaderCargoWeight', e.target.value)}
                  placeholder="z.B. 45000"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.lowloaderRamp}
                onCheckedChange={(v) => updateFormData('lowloaderRamp', v)}
              />
              <Label>Rampe erforderlich</Label>
            </div>
            <div className="space-y-2">
              <Label>Verladung</Label>
              <Select value={formData.loadingMethod} onValueChange={(v) => updateFormData('loadingMethod', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rampe">Rampe</SelectItem>
                  <SelectItem value="kran">Kran</SelectItem>
                  <SelectItem value="selbstfahrend">Selbstfahrend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Neuen Transport anlegen</DialogTitle>
          <DialogDescription>
            Schritt {step} von 5: {steps[step - 1].title}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="px-1">
          <Progress value={(step / 5) * 100} className="h-2" />
          <div className="flex justify-between mt-2">
            {steps.map((s) => (
              <div
                key={s.number}
                className={`text-xs ${
                  step >= s.number ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                {s.title}
              </div>
            ))}
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto py-4">
          {step === 1 && (
            <div className="space-y-4">
              <Label>Transportart auswählen</Label>
              <div className="grid grid-cols-3 gap-3">
                {transportTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTransportType(type.value)}
                    className={`p-4 rounded-xl border-2 text-center transition-all hover:border-primary/50 ${
                      transportType === type.value ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className={`w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-2 ${
                      transportType === type.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {type.icon}
                    </div>
                    <div className="text-sm font-medium">{type.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{type.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              {/* Pickup */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Abholadresse</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Straße und Hausnummer</Label>
                    <Input
                      value={formData.pickupAddress}
                      onChange={(e) => updateFormData('pickupAddress', e.target.value)}
                      placeholder="Musterstraße 123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PLZ</Label>
                    <Input
                      value={formData.pickupPostalCode}
                      onChange={(e) => updateFormData('pickupPostalCode', e.target.value)}
                      placeholder="10115"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stadt</Label>
                    <Input
                      value={formData.pickupCity}
                      onChange={(e) => updateFormData('pickupCity', e.target.value)}
                      placeholder="Berlin"
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Abholdatum</Label>
                      <Input
                        type="date"
                        value={formData.pickupDate}
                        onChange={(e) => updateFormData('pickupDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Zeitraum</Label>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={formData.pickupTimeFrom}
                          onChange={(e) => updateFormData('pickupTimeFrom', e.target.value)}
                        />
                        <Input
                          type="time"
                          value={formData.pickupTimeTo}
                          onChange={(e) => updateFormData('pickupTimeTo', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Delivery */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold">Lieferadresse</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Straße und Hausnummer</Label>
                    <Input
                      value={formData.deliveryAddress}
                      onChange={(e) => updateFormData('deliveryAddress', e.target.value)}
                      placeholder="Beispielstraße 456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>PLZ</Label>
                    <Input
                      value={formData.deliveryPostalCode}
                      onChange={(e) => updateFormData('deliveryPostalCode', e.target.value)}
                      placeholder="80331"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stadt</Label>
                    <Input
                      value={formData.deliveryCity}
                      onChange={(e) => updateFormData('deliveryCity', e.target.value)}
                      placeholder="München"
                    />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Lieferdatum</Label>
                      <Input
                        type="date"
                        value={formData.deliveryDate}
                        onChange={(e) => updateFormData('deliveryDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Zeitraum</Label>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={formData.deliveryTimeFrom}
                          onChange={(e) => updateFormData('deliveryTimeFrom', e.target.value)}
                        />
                        <Input
                          type="time"
                          value={formData.deliveryTimeTo}
                          onChange={(e) => updateFormData('deliveryTimeTo', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {/* Type-specific fields */}
              {renderTypeSpecificFields()}

              <Separator />

              {/* General cargo info */}
              <div className="space-y-4">
                <h3 className="font-semibold">Allgemeine Frachtdaten</h3>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <div className="font-medium">{cargoTypeConfig.label}: {cargoTypeConfig.dimensionLabel}</div>
                  <div className="mt-1 text-muted-foreground">{cargoTypeConfig.example}</div>
                  <div className="mt-2 text-muted-foreground">
                    Preisberechnung nutzt aktuell: {cargoSummaryLine || `${quoteWeightKg} kg`}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    placeholder="Beschreiben Sie Ihre Fracht..."
                    rows={3}
                  />
                </div>
                {['pallet', 'standard'].includes(cargoTypeConfig.measurementMode) && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="space-y-2">
                      <Label>{cargoTypeConfig.weightLabel}</Label>
                      <Input
                        type="number"
                        value={formData.weight}
                        onChange={(e) => updateFormData('weight', e.target.value)}
                        placeholder="500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Länge (cm)</Label>
                      <Input
                        type="number"
                        value={formData.length}
                        onChange={(e) => updateFormData('length', e.target.value)}
                        placeholder="120"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Breite (cm)</Label>
                      <Input
                        type="number"
                        value={formData.width}
                        onChange={(e) => updateFormData('width', e.target.value)}
                        placeholder="80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Höhe (cm)</Label>
                      <Input
                        type="number"
                        value={formData.height}
                        onChange={(e) => updateFormData('height', e.target.value)}
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              {/* AI Price Suggestion */}
              <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">KI-Preisempfehlung</h3>
                        <Badge variant="secondary">
                          {pricingQuote ? 'Live' : 'Beta'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPricingLoading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : null}
                        <Switch checked={showAiPrice} onCheckedChange={setShowAiPrice} />
                      </div>
                    </div>
                    {!canRequestPricing ? (
                      <p className="text-sm text-muted-foreground">
                        Gib Abholstadt, Lieferstadt und Frachtdaten ein, damit CargoBit einen Preis berechnet.
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-3">
                          Basierend auf Strecke ({formData.pickupCity} → {formData.deliveryCity}), Gewicht,
                          Maut, Diesel, Fahrzeit und Transportart.
                        </p>
                        <div className="text-3xl font-bold text-primary">
                          {formatCurrency(recommendedPrice, pricingCurrency)}
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <div className="rounded-lg bg-background/60 p-2">
                            <div>Marktpreis</div>
                            <div className="font-medium text-foreground">
                              {pricingQuote ? formatCurrency(pricingQuote.marketPrice, pricingCurrency) : 'Wird berechnet'}
                            </div>
                          </div>
                          <div className="rounded-lg bg-background/60 p-2">
                            <div>Mindestpreis</div>
                            <div className="font-medium text-foreground">
                              {pricingQuote ? formatCurrency(pricingQuote.minPrice, pricingCurrency) : 'Anti-Dumping'}
                            </div>
                          </div>
                          <div className="rounded-lg bg-background/60 p-2">
                            <div>Distanz</div>
                            <div className="font-medium text-foreground">
                              {pricingQuote ? `${Math.round(pricingQuote.route.distanceKm)} km` : 'Route'}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          {pricingQuote
                            ? `${Math.round(pricingQuote.confidence * 100)}% Konfidenz • ${pricingQuote.modelVersion}`
                            : isPricingLoading
                              ? 'CargoBit berechnet gerade die Empfehlung.'
                              : 'Fallback-Wert bis die Live-Berechnung verfügbar ist.'}
                        </div>
                        {pricingError ? (
                          <div className="mt-2 text-sm text-yellow-600">
                            {pricingError}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Your Budget */}
              <div className="space-y-4">
                <h3 className="font-semibold">Ihr Budget</h3>
                <div className="space-y-2">
                  <Label>Gewünschter Preis (€)</Label>
                  <Input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => updateFormData('budget', e.target.value)}
                    placeholder={String(Math.round(recommendedPrice))}
                  />
                  <p className="text-sm text-muted-foreground">
                    Preis ist verhandelbar. Transporteure können Angebote abgeben.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Insurance referral */}
              <div className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <Shield className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Frachtversicherung optional</h3>
                      <p className="text-sm text-muted-foreground">
                        CargoBit fragt einen externen Versicherungs-Partner an. Der Abschluss erfolgt nicht bei CargoBit.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={formData.insuranceRequested}
                    onCheckedChange={(value) => updateFormData('insuranceRequested', value)}
                  />
                </div>

                {formData.insuranceRequested && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Warenwert (€)</Label>
                      <Input
                        type="number"
                        value={formData.cargoValue}
                        onChange={(event) => updateFormData('cargoValue', event.target.value)}
                        placeholder="z.B. 10000"
                      />
                    </div>

                    {isInsuranceLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Versicherungs-Lead wird vorbereitet.
                      </div>
                    ) : insuranceQuote ? (
                      <div className="grid gap-2 text-sm sm:grid-cols-3">
                        <div className="rounded-lg bg-background/70 p-3">
                          <div className="text-muted-foreground">Partner</div>
                          <div className="font-medium">{insuranceQuote.provider}</div>
                        </div>
                        <div className="rounded-lg bg-background/70 p-3">
                          <div className="text-muted-foreground">Prämie ca.</div>
                          <div className="font-medium">{formatCurrency(insuranceQuote.premiumEstimateEur)}</div>
                        </div>
                        <div className="rounded-lg bg-background/70 p-3">
                          <div className="text-muted-foreground">Deckung bis</div>
                          <div className="font-medium">{formatCurrency(insuranceQuote.coverageEstimateEur)}</div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start gap-2 rounded-lg bg-background/70 p-3 text-xs text-muted-foreground">
                      <Switch
                        checked={formData.insuranceConsent}
                        onCheckedChange={(value) => updateFormData('insuranceConsent', value)}
                      />
                      <span>
                        Ich möchte für diese Fracht eine externe Versicherungsanfrage stellen. CargoBit ist technischer Tippgeber;
                        Beratung, Vertrag, Police und Schadenbearbeitung erfolgen beim lizenzierten Versicherer oder Makler.
                      </span>
                    </div>

                    {insuranceError ? (
                      <div className="text-sm text-yellow-600">{insuranceError}</div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold">Transportübersicht</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Transportart</div>
                    <div className="font-medium">{transportTypes.find(t => t.value === transportType)?.label}</div>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="text-sm text-muted-foreground">Preis</div>
                    <div className="font-medium">
                      {formatCurrency(Number(formData.budget) || recommendedPrice, pricingCurrency)}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Route</span>
                  </div>
                  <div className="font-medium">
                    {formData.pickupAddress || 'Berlin'} → {formData.deliveryAddress || 'München'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formData.pickupDate || 'Heute'} → {formData.deliveryDate || 'Morgen'}
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-sm text-muted-foreground">Fracht</span>
                  </div>
                  <div className="font-medium">{formData.description || 'Paletten'}</div>
                  <div className="text-sm text-muted-foreground">
                    {cargoSummaryLine || `${quoteWeightKg.toLocaleString('de-DE')} kg`}
                  </div>
                </div>

                {formData.insuranceRequested && (
                  <div className="p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Externe Frachtversicherung</span>
                    </div>
                    <div className="font-medium">
                      {insuranceQuote
                        ? `${insuranceQuote.provider} · ca. ${formatCurrency(insuranceQuote.premiumEstimateEur)}`
                        : 'Partner-Lead wird vorbereitet'}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      CargoBit leitet nur weiter; Abschluss und Police erfolgen beim Versicherer/Makler.
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 gap-2"
                      onClick={createInsuranceLead}
                      disabled={isInsuranceLoading || !formData.insuranceConsent}
                    >
                      {isInsuranceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                      Externen Abschluss anfragen
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 p-4 rounded-lg bg-muted">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  Mit dem Erstellen stimmen Sie unseren AGB zu. CargoBit vermittelt den Transport, 
                  ist aber nicht Vertragspartner. Die Zahlung wird über unseren Zahlungsschutz gesichert.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {submitError ? (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700">
            {submitError}
          </div>
        ) : null}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={step === 1 ? () => onOpenChange(false) : handleBack}
            disabled={isSubmitting}
          >
            {step === 1 ? 'Abbrechen' : (
              <>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </>
            )}
          </Button>
          <Button
            onClick={step === 5 ? handleSubmit : handleNext}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            {step === 5 ? 'Transport erstellen' : (
              <>
                Weiter
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
