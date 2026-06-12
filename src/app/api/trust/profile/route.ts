import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getFallbackTrustProfile,
  normalizeProductRole,
  type TrustProfile,
  type TrustSignal,
} from '@/lib/product-operating-model';
import { getOptionalRequestUser, requestUserHasAnyRole } from '@/lib/request-user-auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const requestUser = await getOptionalRequestUser(request);
  const requestedUserId = searchParams.get('userId');
  const userId = requestedUserId || requestUser?.id;

  if (!userId) {
    return NextResponse.json({
      profile: getFallbackTrustProfile(role),
      source: 'fallback',
    });
  }

  if (requestedUserId && !requestUser) {
    return NextResponse.json(
      { error: 'AUTH_REQUIRED', message: 'Authentifizierung erforderlich.' },
      { status: 401 },
    );
  }

  if (
    requestedUserId
    && requestUser
    && requestedUserId !== requestUser.id
    && !requestUserHasAnyRole(requestUser, ['ADMIN', 'SUPPORT'])
  ) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Keine Berechtigung für dieses Trust-Profil.' },
      { status: 403 },
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        verifications: true,
        driver: true,
        wallet: true,
        companyUsers: {
          include: { company: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        profile: getFallbackTrustProfile(role),
        source: 'fallback',
      });
    }

    const profile = buildTrustProfileFromUser(user, role);

    return NextResponse.json({
      profile,
      source: 'database',
    });
  } catch (error) {
    console.error('[TrustProfileAPI] Failed to load profile:', error);
    return NextResponse.json({
      profile: getFallbackTrustProfile(role),
      source: 'fallback',
      warning: 'Database unavailable, using product model fallback',
    });
  }
}

function buildTrustProfileFromUser(user: any, role?: string | null): TrustProfile {
  const normalizedRole = normalizeProductRole(role || user.roles?.[0]?.role?.name);
  const verifications = user.verifications || [];
  const approved = verifications.filter((item: any) => item.status === 'APPROVED');
  const pending = verifications.filter((item: any) => item.status === 'PENDING');
  const rejected = verifications.filter((item: any) => item.status === 'REJECTED');
  const driver = user.driver;
  const wallet = user.wallet;
  const company = user.companyUsers?.[0]?.company;
  const isTransportRole = ['carrier', 'driver', 'dispatcher'].includes(normalizedRole);
  const licenseValid = driver?.licenseExpiry ? new Date(driver.licenseExpiry) > new Date() : false;
  const ratingCount = driver?.ratingCount || 0;
  const ratingAvg = driver?.ratingAvg || 0;

  const signals: TrustSignal[] = [
    {
      id: 'verification',
      label: isTransportRole ? 'KYC/KYB Verifizierung' : 'Identitaet / Firmenprofil',
      detail: approved.length
        ? `${approved.length} Prüfung(en) freigegeben`
        : pending.length
          ? 'Prüfung wartet auf Admin/Support'
          : 'Noch keine abgeschlossene Verifizierung',
      status: approved.length ? 'verified' : pending.length ? 'pending' : 'missing',
      owner: 'CargoBit',
    },
    {
      id: 'license',
      label: 'Lizenz / Fahrerlaubnis',
      detail: driver?.licenseClass
        ? `${driver.licenseClass}${driver.licenseExpiry ? ` bis ${new Date(driver.licenseExpiry).toLocaleDateString('de-DE')}` : ''}`
        : isTransportRole ? 'Fuehrerschein/Transportlizenz fehlt noch' : 'Nur passende Anbieter duerfen bieten',
      status: !isTransportRole ? 'verified' : licenseValid ? 'verified' : driver?.licenseClass ? 'warning' : 'missing',
      owner: 'Nutzer',
    },
    {
      id: 'insurance',
      label: 'Versicherung',
      detail: company?.verificationStatus === 'APPROVED'
        ? 'Firmenprofil verifiziert, Versicherungsnachweis im Review-Prozess'
        : 'CMR/Frachtversicherung je Auftrag oder Profil erforderlich',
      status: isTransportRole ? 'pending' : 'verified',
      owner: 'Partner',
    },
    {
      id: 'rating',
      label: 'Bewertungen',
      detail: ratingCount ? `${ratingAvg.toFixed(1)}/5 aus ${ratingCount} Bewertung(en)` : 'Noch zu wenige abgeschlossene Transporte',
      status: ratingCount >= 5 ? 'verified' : 'pending',
      owner: 'System',
    },
    {
      id: 'payment_protection',
      label: 'Zahlungsabsicherung',
      detail: wallet ? `Zahlungsschutz ${wallet.status}, ${wallet.balance.toFixed(2)} ${wallet.currency}` : 'Zahlungsschutz wird vor Buchung benoetigt',
      status: wallet?.status === 'ACTIVE' ? 'verified' : 'missing',
      owner: 'CargoBit',
    },
  ];

  const score = Math.max(
    20,
    signals.reduce((sum, signal) => {
      if (signal.status === 'verified') return sum + 20;
      if (signal.status === 'pending') return sum + 10;
      if (signal.status === 'warning') return sum + 5;
      return sum;
    }, rejected.length ? -20 : 0),
  );

  return {
    score: Math.min(score, 100),
    level: rejected.length ? 'restricted' : score >= 90 ? 'premium' : score >= 70 ? 'trusted' : 'starter',
    title: isTransportRole ? 'Transporteur Trust Profil' : 'Auftraggeber Trust Profil',
    summary: rejected.length
      ? 'Es gibt abgelehnte Prüfpunkte. Support muss den Account vor kritischen Aktionen prüfen.'
      : 'Dieses Profil verbindet Verifizierung, Zahlungsschutz, Lizenzen und Bewertungen in einem sichtbaren Trust Score.',
    signals,
    requiredNextSteps: signals
      .filter((signal) => signal.status !== 'verified')
      .map((signal) => signal.label),
  };
}
