/**
 * CargoBit Map Service
 *
 * Server-neutral provider layer for route calculation and geocoding.
 * Production can use Google Maps Platform, tests and CI can use the mock
 * provider without API keys or external network calls.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street: string;
  streetNumber?: string;
  postalCode: string;
  city: string;
  country: string;
  countryCode: string;
}

export interface RouteResult {
  distance: number;
  duration: number;
  tollCost: number;
  fuelCost: number;
  polyline?: string;
  transitCountries: string[];
  waypoints: Coordinates[];
  provider: 'google' | 'mock';
}

export interface GeocodingResult {
  coordinates: Coordinates;
  formattedAddress: string;
  address: Address;
  confidence: number;
  provider: 'google' | 'mock';
}

export interface TollInfo {
  country: string;
  system: string;
  cost: number;
  currency: string;
}

interface MapProvider {
  geocode(address: string): Promise<GeocodingResult | null>;
  reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null>;
  calculateRoute(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints?: (Coordinates | string)[],
    options?: RouteOptions,
  ): Promise<RouteResult | null>;
}

interface RouteOptions {
  avoidTolls?: boolean;
  vehicleType?: 'truck' | 'car';
  hazmat?: boolean;
}

class GoogleMapsProvider implements MapProvider {
  private readonly serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  private readonly geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
  private readonly routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  isConfigured() {
    return Boolean(this.serverKey);
  }

  async geocode(address: string): Promise<GeocodingResult | null> {
    if (!this.serverKey) return null;

    const url = new URL(this.geocodeUrl);
    url.searchParams.set('address', address);
    url.searchParams.set('language', 'de');
    url.searchParams.set('region', 'de');
    url.searchParams.set('key', this.serverKey);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    const components = parseGoogleAddressComponents(result.address_components || []);

    return {
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
      formattedAddress: result.formatted_address,
      address: components,
      confidence: result.partial_match ? 0.65 : 0.95,
      provider: 'google',
    };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    if (!this.serverKey) return null;

    const url = new URL(this.geocodeUrl);
    url.searchParams.set('latlng', `${coordinates.lat},${coordinates.lng}`);
    url.searchParams.set('language', 'de');
    url.searchParams.set('key', this.serverKey);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    const components = parseGoogleAddressComponents(result.address_components || []);

    return {
      coordinates,
      formattedAddress: result.formatted_address,
      address: components,
      confidence: 0.9,
      provider: 'google',
    };
  }

  async calculateRoute(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints?: (Coordinates | string)[],
    options?: RouteOptions,
  ): Promise<RouteResult | null> {
    if (!this.serverKey) return null;

    const originCoords = await this.resolveCoordinates(origin);
    const destinationCoords = await this.resolveCoordinates(destination);

    if (!originCoords || !destinationCoords) return null;

    const intermediates = await Promise.all((waypoints || []).map((waypoint) => this.resolveCoordinates(waypoint)));

    const requestBody = {
      origin: toGoogleWaypoint(originCoords),
      destination: toGoogleWaypoint(destinationCoords),
      intermediates: intermediates.filter(Boolean).map((point) => toGoogleWaypoint(point as Coordinates)),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: Boolean(options?.avoidTolls),
      },
      languageCode: 'de-DE',
      units: 'METRIC',
    };

    const response = await fetch(this.routesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.serverKey,
        'X-Goog-FieldMask': [
          'routes.distanceMeters',
          'routes.duration',
          'routes.staticDuration',
          'routes.polyline.encodedPolyline',
          'routes.travelAdvisory.tollInfo',
        ].join(','),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const distanceMeters = Number(route.distanceMeters || 0);
    const durationSeconds = parseGoogleDuration(route.duration);

    return {
      distance: Math.round(distanceMeters / 1000),
      duration: Math.round(durationSeconds / 60),
      tollCost: parseGoogleTollCost(route.travelAdvisory?.tollInfo),
      fuelCost: estimateFuelCost(distanceMeters, options?.vehicleType !== 'car'),
      polyline: route.polyline?.encodedPolyline,
      transitCountries: [],
      waypoints: [originCoords, destinationCoords],
      provider: 'google',
    };
  }

  private async resolveCoordinates(input: Coordinates | string): Promise<Coordinates | null> {
    if (typeof input !== 'string') return input;
    const result = await this.geocode(input);
    return result?.coordinates || null;
  }
}

class MockMapProvider implements MapProvider {
  async geocode(address: string): Promise<GeocodingResult> {
    const coordinates = getMockCoordinates(address);

    return {
      coordinates,
      formattedAddress: address,
      address: {
        street: '',
        postalCode: '',
        city: address,
        country: 'Deutschland',
        countryCode: 'DE',
      },
      confidence: 0.8,
      provider: 'mock',
    };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult> {
    return {
      coordinates,
      formattedAddress: `${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`,
      address: {
        street: '',
        postalCode: '',
        city: '',
        country: '',
        countryCode: '',
      },
      confidence: 0.5,
      provider: 'mock',
    };
  }

  async calculateRoute(
    origin: Coordinates | string,
    destination: Coordinates | string,
    _waypoints?: (Coordinates | string)[],
    _options?: RouteOptions,
  ): Promise<RouteResult> {
    const originCoords = typeof origin === 'string' ? getMockCoordinates(origin) : origin;
    const destinationCoords = typeof destination === 'string' ? getMockCoordinates(destination) : destination;
    const distance = calculateDistance(originCoords, destinationCoords);

    return {
      distance,
      duration: Math.round((distance / 62) * 60),
      tollCost: Math.round(distance * 0.15 * 100) / 100,
      fuelCost: estimateFuelCost(distance * 1000, true),
      polyline: undefined,
      transitCountries: [],
      waypoints: [originCoords, destinationCoords],
      provider: 'mock',
    };
  }
}

class MapService implements MapProvider {
  private readonly googleProvider = new GoogleMapsProvider();
  private readonly mockProvider = new MockMapProvider();

  private get provider(): MapProvider {
    const requestedProvider = (process.env.MAP_PROVIDER || 'mock').toLowerCase();

    if (requestedProvider === 'google' && this.googleProvider.isConfigured()) {
      return this.googleProvider;
    }

    return this.mockProvider;
  }

  async geocode(address: string): Promise<GeocodingResult | null> {
    try {
      return await this.provider.geocode(address);
    } catch (error) {
      console.error('[MapService] Geocoding failed:', error);
      return this.mockProvider.geocode(address);
    }
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    try {
      return await this.provider.reverseGeocode(coordinates);
    } catch (error) {
      console.error('[MapService] Reverse geocoding failed:', error);
      return this.mockProvider.reverseGeocode(coordinates);
    }
  }

  async calculateRoute(
    origin: Coordinates | string,
    destination: Coordinates | string,
    waypoints?: (Coordinates | string)[],
    options?: RouteOptions,
  ): Promise<RouteResult | null> {
    try {
      return await this.provider.calculateRoute(origin, destination, waypoints, options);
    } catch (error) {
      console.error('[MapService] Route calculation failed:', error);
      return this.mockProvider.calculateRoute(origin, destination, waypoints, options);
    }
  }

  async getTollInfo(origin: Coordinates, destination: Coordinates): Promise<TollInfo[]> {
    const route = await this.calculateRoute(origin, destination);
    if (!route) return [];

    return [
      { country: 'DE', system: route.provider === 'google' ? 'Google Routes API' : 'Mock Toll', cost: route.tollCost, currency: 'EUR' },
    ];
  }

  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    return calculateDistance(coord1, coord2);
  }

  async isInternationalRoute(origin: Coordinates, destination: Coordinates): Promise<boolean> {
    const [originAddress, destinationAddress] = await Promise.all([
      this.reverseGeocode(origin),
      this.reverseGeocode(destination),
    ]);

    return Boolean(originAddress?.address.countryCode && destinationAddress?.address.countryCode)
      && originAddress?.address.countryCode !== destinationAddress?.address.countryCode;
  }
}

function parseGoogleAddressComponents(components: Array<{ long_name: string; short_name: string; types: string[] }>): Address {
  const get = (type: string, short = false) => {
    const component = components.find((item) => item.types.includes(type));
    return short ? component?.short_name || '' : component?.long_name || '';
  };

  return {
    street: get('route'),
    streetNumber: get('street_number'),
    postalCode: get('postal_code'),
    city: get('locality') || get('administrative_area_level_2'),
    country: get('country'),
    countryCode: get('country', true),
  };
}

function toGoogleWaypoint(coordinates: Coordinates) {
  return {
    location: {
      latLng: {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      },
    },
  };
}

function parseGoogleDuration(duration?: string): number {
  if (!duration) return 0;
  return Number(duration.replace('s', '')) || 0;
}

function parseGoogleTollCost(tollInfo?: { estimatedPrice?: Array<{ currencyCode?: string; units?: string; nanos?: number }> }): number {
  const price = tollInfo?.estimatedPrice?.[0];
  if (!price) return 0;

  const units = Number(price.units || 0);
  const nanos = Number(price.nanos || 0) / 1_000_000_000;
  return Math.round((units + nanos) * 100) / 100;
}

function estimateFuelCost(distanceMeters: number, isTruck = true): number {
  const distanceKm = distanceMeters / 1000;
  const fuelEfficiency = isTruck ? 30 : 8;
  const fuelPrice = 1.8;
  return Math.round(distanceKm * (fuelEfficiency / 100) * fuelPrice * 100) / 100;
}

function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const earthRadiusKm = 6371;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusKm * c * 10) / 10;
}

function toRad(degrees: number) {
  return degrees * (Math.PI / 180);
}

function getMockCoordinates(address: string): Coordinates {
  const cityCoords: Record<string, Coordinates> = {
    berlin: { lat: 52.5219, lng: 13.4132 },
    hamburg: { lat: 53.5526, lng: 9.9932 },
    muenchen: { lat: 48.1374, lng: 11.5755 },
    munich: { lat: 48.1374, lng: 11.5755 },
    'münchen': { lat: 48.1374, lng: 11.5755 },
    koeln: { lat: 50.9375, lng: 6.9603 },
    'köln': { lat: 50.9375, lng: 6.9603 },
    frankfurt: { lat: 50.1109, lng: 8.6821 },
    wien: { lat: 48.2082, lng: 16.3738 },
    zürich: { lat: 47.3769, lng: 8.5417 },
    zurich: { lat: 47.3769, lng: 8.5417 },
    prag: { lat: 50.0755, lng: 14.4378 },
    amsterdam: { lat: 52.3731, lng: 4.8922 },
    paris: { lat: 48.8566, lng: 2.3522 },
    barcelona: { lat: 41.3874, lng: 2.1686 },
  };

  const normalized = address.toLowerCase();
  const city = Object.keys(cityCoords).find((key) => normalized.includes(key));
  return cityCoords[city || 'berlin'];
}

export const mapService = new MapService();
export default mapService;
