import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { InternationalCheckRequest, InternationalCheckResponse, BorderCheck, ApiErrorResponse } from '@/types/matching';

// POST /api/matching/international/check - Check international transport requirements
export async function POST(request: NextRequest) {
  try {
    const body: InternationalCheckRequest = await request.json();

    if (!body.transportId || !body.driverId || !body.vehicleId) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'ValidationError',
        message: 'Missing required fields: transportId, driverId, vehicleId',
        code: 'MISSING_FIELDS'
      }, { status: 400 });
    }

    // Get transport, driver, and vehicle
    const [transport, driver, vehicle] = await Promise.all([
      prisma.transport.findUnique({
        where: { id: body.transportId }
      }),
      prisma.user.findUnique({
        where: { id: body.driverId },
        include: { driverPermissions: true, documents: true }
      }),
      prisma.vehicle.findUnique({
        where: { id: body.vehicleId }
      })
    ]);

    if (!transport || !driver || !vehicle) {
      return NextResponse.json<ApiErrorResponse>({
        error: 'NotFoundError',
        message: 'Transport, driver, or vehicle not found',
        code: 'NOT_FOUND'
      }, { status: 404 });
    }

    const issues: string[] = [];
    const borderChecks: BorderCheck[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Parse requirements
    const intlReqs = transport.internationalRequirements 
      ? JSON.parse(transport.internationalRequirements) 
      : {};
    const vehicleReqs = transport.vehicleRequirements 
      ? JSON.parse(transport.vehicleRequirements) 
      : {};

    // ========== DRIVER PERMISSIONS CHECK ==========

    // Check international permission
    if (!driver.internationalAllowed) {
      issues.push('Fahrer hat keine internationale Fahrerlaubnis');
      riskLevel = 'high';
    }

    // Check country permissions
    const driverPermissions = driver.driverPermissions.filter(p => p.isAllowed);
    const allowedCountries = driverPermissions.map(p => p.countryCode);

    const targetCountry = transport.deliveryCountry;
    if (!allowedCountries.includes(targetCountry)) {
      issues.push(`Keine Genehmigung für Zielland ${targetCountry}`);
      riskLevel = 'high';
    }

    // Check transit countries
    const transitCountries = intlReqs.transitCountries || [];
    for (const transitCountry of transitCountries) {
      if (!allowedCountries.includes(transitCountry)) {
        issues.push(`Keine Genehmigung für Transitland ${transitCountry}`);
        riskLevel = 'high';
      }
    }

    // ========== BORDER CROSSING CHECKS ==========

    // Get border crossing info from database
    const borders = await prisma.borderCrossing.findMany({
      where: {
        OR: [
          { fromCountry: transport.pickupCountry, toCountry: targetCountry },
          ...transitCountries.map((tc: string, i: number, arr: string[]) => ({
            fromCountry: i === 0 ? transport.pickupCountry : arr[i - 1],
            toCountry: tc
          })),
          ...(transitCountries.length > 0 ? [{
            fromCountry: transitCountries[transitCountries.length - 1],
            toCountry: targetCountry
          }] : [])
        ]
      }
    });

    // Check each border
    const countries = [transport.pickupCountry, ...transitCountries, targetCountry];
    for (let i = 0; i < countries.length - 1; i++) {
      const from = countries[i];
      const to = countries[i + 1];

      const borderInfo = borders.find(b => b.fromCountry === from && b.toCountry === to);
      
      const check: BorderCheck = {
        fromCountry: from,
        toCountry: to,
        crossingPoint: borderInfo?.crossingName,
        allowed: true,
        issues: [],
        adrAllowed: borderInfo?.adrAllowed ?? true,
        tunnelRestrictions: borderInfo?.tunnelCode ? [borderInfo.tunnelCode] : undefined
      };

      // Check ADR at border
      if (vehicleReqs.adrRequired && !check.adrAllowed) {
        check.allowed = false;
        check.issues.push('ADR-Transport an dieser Grenze nicht erlaubt');
        riskLevel = 'high';
      }

      // Check tunnel codes
      if (borderInfo?.tunnelCode && vehicle.tunnelCodes) {
        const vehicleTunnelCodes = JSON.parse(vehicle.tunnelCodes);
        // Tunnel code restriction check
        check.issues.push(`Tunnel-Beschränkung: Code ${borderInfo.tunnelCode}`);
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      if (!check.allowed) issues.push(`Grenze ${from} → ${to}: ${check.issues.join(', ')}`);
      
      borderChecks.push(check);
    }

    // ========== TUNNEL CODES CHECK ==========

    const requiredTunnelCodes = vehicleReqs.tunnelCodes || [];
    const vehicleTunnelCodes = vehicle.tunnelCodes ? JSON.parse(vehicle.tunnelCodes) : [];
    
    const tunnelCodes = {
      required: requiredTunnelCodes,
      vehicle: vehicleTunnelCodes,
      compatible: true
    };

    // Check tunnel code compatibility
    // A = most restrictive, E = least
    // Vehicle must have equal or better (higher letter) code
    if (requiredTunnelCodes.length > 0 && vehicleTunnelCodes.length > 0) {
      const codeValues: Record<string, number> = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
      const minRequiredCode = Math.min(...requiredTunnelCodes.map((c: string) => codeValues[c] || 0));
      const minVehicleCode = Math.min(...vehicleTunnelCodes.map((c: string) => codeValues[c] || 0));
      
      if (minVehicleCode < minRequiredCode) {
        tunnelCodes.compatible = false;
        issues.push('Tunnel-Code des Fahrzeugs nicht kompatibel');
        riskLevel = 'high';
      }
    }

    // ========== DOCUMENTS CHECK ==========

    const requiredDocs = [
      'CMR' // Always required for international
    ];

    // Add ADR documents if needed
    if (vehicleReqs.adrRequired) {
      requiredDocs.push('ADR_DOCUMENT', 'ADR_DECLARATION');
    }

    // Add customs documents
    if (intlReqs.customsDocuments?.length) {
      requiredDocs.push(...intlReqs.customsDocuments);
    }

    const driverDocs = driver.documents.map(d => d.type);
    const presentDocs = driverDocs.filter(d => requiredDocs.includes(d));
    const missingDocs = requiredDocs.filter(d => !driverDocs.includes(d));

    if (missingDocs.length > 0) {
      issues.push(`Fehlende Dokumente: ${missingDocs.join(', ')}`);
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // ========== TOLL SYSTEMS CHECK ==========

    const tollSystems: { country: string; system: string; estimated: number }[] = [];

    // Get toll systems for route countries
    const routeCountries = [transport.pickupCountry, ...transitCountries, targetCountry];
    const tolls = await prisma.tollSystem.findMany({
      where: { countryCode: { in: routeCountries } }
    });

    for (const country of routeCountries) {
      const countryToll = tolls.find(t => t.countryCode === country);
      if (countryToll) {
        // Estimate toll cost (would calculate actual route in production)
        const estimatedCost = countryToll.systemType === 'VIGNETTE' 
          ? (countryToll.vignetteWeekly || countryToll.vignetteMonthly || 0)
          : (transport.distanceKm || 500) * (countryToll.euro6Rate || 0.15);
        
        tollSystems.push({
          country,
          system: countryToll.systemName,
          estimated: Math.round(estimatedCost)
        });
      }
    }

    // ========== DRIVER DOCUMENTS VALIDITY ==========

    // Check driver card
    if (driver.driverCardExpiry) {
      const expiryDate = new Date(driver.driverCardExpiry);
      if (expiryDate < new Date()) {
        issues.push('Fahrerkarte abgelaufen');
        riskLevel = 'high';
      }
    }

    // Check ADR certificate
    if (vehicleReqs.adrRequired && driver.adrCertified && driver.adrExpiry) {
      const adrExpiry = new Date(driver.adrExpiry);
      if (adrExpiry < new Date()) {
        issues.push('ADR-Bescheinigung abgelaufen');
        riskLevel = 'high';
      }
    }

    // ========== VISA CHECK ==========

    const visaRequired = driver.driverPermissions
      .filter(p => p.visaRequired && allowedCountries.includes(p.countryCode))
      .filter(p => !p.visaValid || (p.visaExpiry && new Date(p.visaExpiry) < new Date()));

    if (visaRequired.length > 0) {
      const countries = visaRequired.map(p => p.countryCode);
      issues.push(`Visum erforderlich/ungültig für: ${countries.join(', ')}`);
      riskLevel = 'high';
    }

    // ========== FINAL RESULT ==========

    const allowed = issues.filter(i => 
      i.includes('nicht erlaubt') || 
      i.includes('Keine Genehmigung') ||
      i.includes('abgelaufen') ||
      i.includes('nicht kompatibel')
    ).length === 0;

    return NextResponse.json<InternationalCheckResponse>({
      allowed,
      issues,
      borderChecks,
      documents: {
        required: requiredDocs,
        present: presentDocs,
        missing: missingDocs
      },
      tollSystems,
      tunnelCodes,
      riskLevel
    }, { status: 200 });

  } catch (error) {
    console.error('International check error:', error);
    return NextResponse.json<ApiErrorResponse>({
      error: 'InternalServerError',
      message: 'Failed to perform international check',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}
