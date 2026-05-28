/**
 * Pricing Preview API
 * POST /api/pricing/quote
 *
 * Calculates a pre-order price recommendation for the transport form.
 * This route does not require a stored transport/orderId.
 */

import { NextRequest, NextResponse } from 'next/server';
import mapService from '@/services/map.service';
import {
  DEFAULT_CURRENCY,
  DEFAULT_PRICING_CONFIG,
  DEFAULT_VEHICLE_PARAMS,
  buildPriceContext,
  calculateHeuristicMarketPrice,
  computeCostBreakdown,
  extractPricingFeatures,
  getFuelPriceByRegion,
  getLaborRateByCountry,
  getRiskFactorFromLevel,
  roundToCents,
  type ExternalPricingData,
  type MarketPriceInput,
} from '@/types/pricing-engine';

type QuoteAddressInput = {
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

const COUNTRY_CODES: Record<string, string> = {
  deutschland: 'DE',
  germany: 'DE',
  de: 'DE',
  oesterreich: 'AT',
  österreich: 'AT',
  austria: 'AT',
  at: 'AT',
  polen: 'PL',
  poland: 'PL',
  pl: 'PL',
  frankreich: 'FR',
  france: 'FR',
  fr: 'FR',
  italien: 'IT',
  italy: 'IT',
  it: 'IT',
  spanien: 'ES',
  spain: 'ES',
  es: 'ES',
  niederlande: 'NL',
  netherlands: 'NL',
  nl: 'NL',
  belgien: 'BE',
  belgium: 'BE',
  be: 'BE',
  tschechien: 'CZ',
  czechia: 'CZ',
  cz: 'CZ',
};

function normalizeCountryCode(country?: string): string {
  const key = String(country || 'DE').trim().toLowerCase();
  return COUNTRY_CODES[key] || key.slice(0, 2).toUpperCase() || 'DE';
}

function formatAddress(address: QuoteAddressInput): string {
  return [
    address.address,
    address.postalCode,
    address.city,
    address.country,
  ].filter(Boolean).join(', ');
}

function parsePositiveNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeTransportType(type?: string): string {
  return String(type || 'PALLET').trim().toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pickup = (body.pickup || {}) as QuoteAddressInput;
    const delivery = (body.delivery || {}) as QuoteAddressInput;
    const originCountry = normalizeCountryCode(pickup.country);
    const destinationCountry = normalizeCountryCode(delivery.country);
    const originAddress = formatAddress(pickup);
    const destinationAddress = formatAddress(delivery);

    if (!pickup.city || !delivery.city) {
      return NextResponse.json({
        error: 'ValidationError',
        message: 'Abhol- und Lieferstadt werden für die Preisempfehlung benötigt.',
        code: 'MISSING_ROUTE',
      }, { status: 400 });
    }

    const route = await mapService.calculateRoute(
      originAddress || pickup.city,
      destinationAddress || delivery.city,
      undefined,
      {
        vehicleType: 'truck',
        hazmat: Boolean(body.isHazmat),
      },
    );

    const distanceKm = parsePositiveNumber(body.distanceKm) || route?.distance || 0;
    const weightKg = parsePositiveNumber(body.weightKg) || 500;
    const volumeM3 = parsePositiveNumber(body.volumeM3);
    const transportType = normalizeTransportType(body.transportType);
    const isInternational = body.isInternational ?? originCountry !== destinationCountry;
    const riskLevel = ['green', 'yellow', 'red'].includes(body.riskLevel)
      ? body.riskLevel as 'green' | 'yellow' | 'red'
      : 'green';

    if (distanceKm <= 0) {
      return NextResponse.json({
        error: 'PricingError',
        message: 'Route konnte nicht berechnet werden.',
        code: 'ROUTE_NOT_FOUND',
      }, { status: 422 });
    }

    const input: MarketPriceInput = {
      orderId: body.orderId || `quote_${Date.now()}`,
      origin: {
        country: originCountry,
        postalCode: pickup.postalCode,
      },
      destination: {
        country: destinationCountry,
        postalCode: delivery.postalCode,
      },
      distanceKm,
      weightKg,
      volumeM3,
      transportType,
      isInternational,
      isHazmat: Boolean(body.isHazmat),
      requiresCooling: Boolean(body.requiresCooling),
    };

    const avgSpeedKmh = 70;
    const tollCostEstimate = route?.tollCost ?? roundToCents(distanceKm * 0.15);
    const externalData: ExternalPricingData = {
      fuelPricePerLiter: getFuelPriceByRegion(originCountry),
      fuelRegion: originCountry,
      tollCostEstimate,
      hourlyRate: getLaborRateByCountry(originCountry),
      laborCountry: originCountry,
      avgSpeedKmh,
      drivingHours: distanceKm / avgSpeedKmh,
      riskFactor: getRiskFactorFromLevel(riskLevel),
      riskLevel,
    };

    const costBreakdown = computeCostBreakdown(
      distanceKm,
      weightKg,
      externalData,
      DEFAULT_VEHICLE_PARAMS,
      {
        isInternational,
        isHazmat: Boolean(body.isHazmat),
        requiresCooling: Boolean(body.requiresCooling),
      },
    );

    const heuristicMarketPrice = roundToCents(calculateHeuristicMarketPrice(input));
    const marketPrice = roundToCents((costBreakdown.total * 0.7) + (heuristicMarketPrice * 0.3));
    const priceContext = buildPriceContext(
      marketPrice,
      riskLevel,
      DEFAULT_PRICING_CONFIG,
      DEFAULT_CURRENCY,
    );

    return NextResponse.json({
      orderId: input.orderId,
      marketPrice: priceContext.marketPrice,
      startPrice: priceContext.adjustedStartPrice,
      minPrice: priceContext.adjustedMinPrice,
      baseStartPrice: priceContext.startPrice,
      baseMinPrice: priceContext.minPrice,
      recommendedPrice: priceContext.adjustedStartPrice,
      currency: DEFAULT_CURRENCY,
      riskLevel,
      confidence: route ? 0.82 : 0.7,
      modelVersion: 'pricing-preview-hybrid-v1',
      source: route ? 'route-cost-hybrid' : 'heuristic-fallback',
      route: {
        distanceKm,
        durationMinutes: route?.duration ?? Math.round((distanceKm / avgSpeedKmh) * 60),
        tollCost: tollCostEstimate,
        transitCountries: route?.transitCountries || [],
      },
      costBreakdown,
      features: extractPricingFeatures(input),
    });
  } catch (error) {
    console.error('[PricingQuote] Error:', error);
    return NextResponse.json({
      error: 'InternalServerError',
      message: 'Preisempfehlung konnte nicht berechnet werden.',
      code: 'PRICING_QUOTE_FAILED',
    }, { status: 500 });
  }
}
