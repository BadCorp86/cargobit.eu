'use client';

import { useState } from 'react';
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
} from 'lucide-react';

interface TransportFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}

type TransportType = 'pallet' | 'bulk' | 'liquid' | 'oversize' | 'lowloader' | 'car_transport' | 'cooling' | 'hazmat' | 'container';

const transportTypes: { value: TransportType; label: string; icon: React.ReactNode }[] = [
  { value: 'pallet', label: 'Palettentransport', icon: <Package className="w-5 h-5" /> },
  { value: 'bulk', label: 'Schüttgut', icon: <Scale className="w-5 h-5" /> },
  { value: 'liquid', label: 'Flüssigkeiten', icon: <Droplets className="w-5 h-5" /> },
  { value: 'oversize', label: 'Überlänge', icon: <Truck className="w-5 h-5" /> },
  { value: 'lowloader', label: 'Tieflader', icon: <Truck className="w-5 h-5" /> },
  { value: 'car_transport', label: 'Autotransport', icon: <Car className="w-5 h-5" /> },
  { value: 'cooling', label: 'Kühltransport', icon: <Thermometer className="w-5 h-5" /> },
  { value: 'hazmat', label: 'Gefahrgut', icon: <AlertTriangle className="w-5 h-5" /> },
  { value: 'container', label: 'Container', icon: <Container className="w-5 h-5" /> },
];

export function TransportForm({ open, onOpenChange, onSubmit }: TransportFormProps) {
  const [step, setStep] = useState(1);
  const [transportType, setTransportType] = useState<TransportType>('pallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAiPrice, setShowAiPrice] = useState(true);
  
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
    liquidContainerType: '',
    
    oversizeLength: '',
    oversizeWidth: '',
    oversizeHeight: '',
    oversizePermits: false,
    escortVehicle: false,
    
    lowloaderCargoHeight: '',
    lowloaderCargoWeight: '',
    lowloaderRamp: false,
    
    carCount: '',
    carTypes: '',
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
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    onSubmit();
    // Reset form
    setStep(1);
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
                <Label>Fahrzeugtypen</Label>
                <Input
                  value={formData.carTypes}
                  onChange={(e) => updateFormData('carTypes', e.target.value)}
                  placeholder="z.B. Pkw, SUV"
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
                <div className="space-y-2">
                  <Label>Beschreibung</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => updateFormData('description', e.target.value)}
                    placeholder="Beschreiben Sie Ihre Fracht..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Gewicht (kg)</Label>
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
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">KI-Preisempfehlung</h3>
                      <Badge variant="secondary">Beta</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Basierend auf Strecke ({formData.pickupCity || 'Berlin'} → {formData.deliveryCity || 'München'}), 
                      Gewicht und aktuellen Marktpreisen.
                    </p>
                    <div className="text-3xl font-bold text-primary">€{formData.aiSuggestedPrice}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Marktpreis: €420 - €520
                    </div>
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
                    placeholder={formData.aiSuggestedPrice.toString()}
                  />
                  <p className="text-sm text-muted-foreground">
                    Preis ist verhandelbar. Transporteure können Angebote abgeben.
                  </p>
                </div>
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
                    <div className="font-medium">€{formData.budget || formData.aiSuggestedPrice}</div>
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
                    {formData.weight || '500'} kg • {formData.length || '120'} × {formData.width || '80'} × {formData.height || '100'} cm
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-4 rounded-lg bg-muted">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  Mit dem Erstellen stimmen Sie unseren AGB zu. CargoBit vermittelt den Transport, 
                  ist aber nicht Vertragspartner. Die Zahlung wird über unser Escrow-System gesichert.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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
