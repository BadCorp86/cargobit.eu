export type CargoTransportType =
  | 'pallet'
  | 'bulk'
  | 'liquid'
  | 'oversize'
  | 'lowloader'
  | 'car_transport'
  | 'cooling'
  | 'hazmat'
  | 'container';

export type CargoMeasurementMode =
  | 'pallet'
  | 'bulk'
  | 'liquid'
  | 'vehicle'
  | 'meter_dimensions'
  | 'container'
  | 'standard';

export interface CargoTypeConfig {
  value: CargoTransportType;
  label: string;
  shortLabel: string;
  description: string;
  measurementMode: CargoMeasurementMode;
  weightLabel: string;
  dimensionLabel: string;
  example: string;
}

export const CARGO_TYPE_CONFIGS: CargoTypeConfig[] = [
  {
    value: 'pallet',
    label: 'Palettentransport',
    shortLabel: 'Paletten / Standardfracht',
    description: 'Paletten, Kartons und normale Stückgüter mit Gewicht und optionalen cm-Maßen.',
    measurementMode: 'pallet',
    weightLabel: 'Gesamtgewicht (kg)',
    dimensionLabel: 'Maße je Packstück oder Palette (cm)',
    example: 'z. B. 5 Europaletten, 2.500 kg, stapelbar',
  },
  {
    value: 'bulk',
    label: 'Schüttgut',
    shortLabel: 'Schüttgut',
    description: 'Lose Ware wie Sand, Kies, Getreide oder Granulat mit Volumen und Dichte.',
    measurementMode: 'bulk',
    weightLabel: 'Gesamtgewicht (kg) oder berechnet aus Dichte',
    dimensionLabel: 'Volumen (m³)',
    example: 'z. B. 25 m³ Kies, 1.600 kg/m³',
  },
  {
    value: 'liquid',
    label: 'Flüssigkeiten',
    shortLabel: 'Flüssigkeiten',
    description: 'Flüssige Ware in Tank, IBC, Fass oder Tankcontainer mit Liter- oder m³-Angabe.',
    measurementMode: 'liquid',
    weightLabel: 'Gewicht optional (kg)',
    dimensionLabel: 'Menge in Liter oder m³',
    example: 'z. B. 20.000 Liter, IBC oder Tankauflieger',
  },
  {
    value: 'oversize',
    label: 'Übergröße',
    shortLabel: 'Übergröße',
    description: 'Lange, breite oder hohe Fracht mit Metermaßen, Genehmigung und Begleitfahrzeug.',
    measurementMode: 'meter_dimensions',
    weightLabel: 'Gewicht (kg)',
    dimensionLabel: 'Länge, Breite, Höhe (m)',
    example: 'z. B. 18,5 m × 3,2 m × 4,0 m, 35.000 kg',
  },
  {
    value: 'lowloader',
    label: 'Tieflader',
    shortLabel: 'Tieflader',
    description: 'Maschinen, Bauteile und schwere Fracht mit Metermaßen und Verladeart.',
    measurementMode: 'meter_dimensions',
    weightLabel: 'Ladungsgewicht (kg)',
    dimensionLabel: 'Länge, Breite, Höhe (m)',
    example: 'z. B. Baumaschine, 8,0 m × 2,8 m × 3,5 m, 45.000 kg',
  },
  {
    value: 'car_transport',
    label: 'Fahrzeugtransport',
    shortLabel: 'Fahrzeugtransport',
    description: 'Autos, Oldtimer, SUV, Wohnmobile, Wohnwagen und Trailer mit Fahrzeugmaßen.',
    measurementMode: 'vehicle',
    weightLabel: 'Fahrzeuggewicht (kg)',
    dimensionLabel: 'Länge, Breite, Höhe (m)',
    example: 'z. B. SUV, 4,8 m × 1,9 m × 1,7 m, 2.100 kg',
  },
  {
    value: 'cooling',
    label: 'Kühltransport',
    shortLabel: 'Kühltransport',
    description: 'Temperaturgeführte Ware mit Temperaturbereich, Gewicht und Volumen.',
    measurementMode: 'standard',
    weightLabel: 'Gesamtgewicht (kg)',
    dimensionLabel: 'Maße oder Volumen der Ware',
    example: 'z. B. Lebensmittel, +2 °C bis +8 °C, 1.200 kg',
  },
  {
    value: 'hazmat',
    label: 'Gefahrgut',
    shortLabel: 'Gefahrgut',
    description: 'ADR-pflichtige Ware mit UN-Nummer, Klasse, Verpackungsgruppe und Menge.',
    measurementMode: 'standard',
    weightLabel: 'Gesamtgewicht (kg)',
    dimensionLabel: 'Menge, Maße oder Volumen',
    example: 'z. B. UN1203, Klasse 3, Verpackungsgruppe II',
  },
  {
    value: 'container',
    label: 'Container',
    shortLabel: 'Container',
    description: '20ft, 40ft, 45ft, Reefer, Tankcontainer oder Open-Top-Container.',
    measurementMode: 'container',
    weightLabel: 'Bruttogewicht (kg)',
    dimensionLabel: 'Containergröße',
    example: 'z. B. 40ft Standard, 24.000 kg, Plombe optional',
  },
];

export const CARGO_TYPE_LABELS = CARGO_TYPE_CONFIGS.reduce(
  (labels, config) => ({ ...labels, [config.value]: config.shortLabel }),
  {} as Record<CargoTransportType, string>,
);

export const VEHICLE_TYPE_OPTIONS = [
  { value: 'sportauto', label: 'Sportauto', example: 'z. B. Porsche 911' },
  { value: 'suv', label: 'SUV', example: 'z. B. BMW X5' },
  { value: 'oldtimer', label: 'Oldtimer', example: 'z. B. Mercedes SL' },
  { value: 'motorrad', label: 'Motorrad', example: 'z. B. Reiseenduro' },
  { value: 'transporter', label: 'Transporter', example: 'z. B. Sprinter' },
  { value: 'wohnmobil', label: 'Wohnmobil', example: 'z. B. 7,4 m Länge' },
  { value: 'wohnwagen', label: 'Wohnwagen', example: 'z. B. Tandemachser' },
  { value: 'boot_trailer', label: 'Boot/Trailer', example: 'z. B. Boot auf Trailer' },
  { value: 'sonstiges', label: 'Sonstiges', example: 'Sonderfahrzeug beschreiben' },
];

export const LIQUID_UNIT_OPTIONS = [
  { value: 'liter', label: 'Liter' },
  { value: 'm3', label: 'm³' },
] as const;

export const CONTAINER_VOLUME_M3: Record<string, number> = {
  '20ft': 33.2,
  '40ft': 67.7,
  '45ft': 86,
  reefer: 67,
  tank: 26,
  open_top: 67,
};

export function getCargoTypeConfig(type: string): CargoTypeConfig {
  return CARGO_TYPE_CONFIGS.find((config) => config.value === type) ?? CARGO_TYPE_CONFIGS[0];
}
