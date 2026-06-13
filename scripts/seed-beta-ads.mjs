#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = process.cwd();
loadDotEnv(path.join(root, '.env'));

const prisma = new PrismaClient();

const ids = {
  partner: 'beta_ads_partner_cargobit',
  apiKey: 'beta_ads_partner_api_key',
  pendingCampaign: 'beta_ads_pending_homepage',
  activeCampaign: 'beta_ads_active_homepage_preview',
};

const rawApiKey = process.env.BETA_ADS_API_KEY || 'cb_partner_beta_ads_local_test_key_DO_NOT_USE_IN_PROD';
const includeActivePreview =
  process.env.SEED_BETA_ADS_ACTIVE === 'true' && process.env.NODE_ENV !== 'production';

async function main() {
  const partner = await prisma.partner.upsert({
    where: { id: ids.partner },
    update: {
      name: 'CargoBit Beta Ads Partner',
      type: 'ADS',
      contactEmail: 'ads.partner@cargobit.local',
      contactPhone: '+49 30 000000',
      contactPerson: 'Beta Ads Team',
      website: 'https://cargobit.eu',
      country: 'DE',
      status: 'ACTIVE',
      statusReason: null,
      testMode: true,
      liveModeEnabled: false,
      approvedAt: new Date(),
      approvedBy: 'seed-beta-ads',
      commissionRate: 0,
    },
    create: {
      id: ids.partner,
      name: 'CargoBit Beta Ads Partner',
      type: 'ADS',
      contactEmail: 'ads.partner@cargobit.local',
      contactPhone: '+49 30 000000',
      contactPerson: 'Beta Ads Team',
      website: 'https://cargobit.eu',
      country: 'DE',
      status: 'ACTIVE',
      testMode: true,
      liveModeEnabled: false,
      approvedAt: new Date(),
      approvedBy: 'seed-beta-ads',
      commissionRate: 0,
    },
  });

  await prisma.partnerApiKey.upsert({
    where: { id: ids.apiKey },
    update: {
      partnerId: partner.id,
      name: 'Beta Ads Test Key',
      apiKey: hashApiKey(rawApiKey),
      apiKeyPrefix: getApiKeyPrefix(rawApiKey),
      scopes: JSON.stringify(['ads:read', 'ads:write']),
      status: 'ACTIVE',
      isTestKey: true,
      expiresAt: null,
      revokedAt: null,
      revokedReason: null,
    },
    create: {
      id: ids.apiKey,
      partnerId: partner.id,
      name: 'Beta Ads Test Key',
      apiKey: hashApiKey(rawApiKey),
      apiKeyPrefix: getApiKeyPrefix(rawApiKey),
      scopes: JSON.stringify(['ads:read', 'ads:write']),
      status: 'ACTIVE',
      isTestKey: true,
    },
  });

  await prisma.partnerAdCampaign.upsert({
    where: { id: ids.pendingCampaign },
    update: {
      partnerId: partner.id,
      name: 'Beta Anzeige: Flottenservice prüfen',
      description: 'Prüfpflichtige CPC-Testkampagne für den Admin-Werbeprozess.',
      slot: 'MARKETPLACE_BANNER',
      bannerUrl: null,
      bannerAlt: 'CargoBit Beta Anzeige Flottenservice',
      targetUrl: 'https://cargobit.eu/versicherung-partner',
      callToAction: 'Partnerangebot prüfen',
      budgetEur: 250,
      spentEur: 0,
      currency: 'EUR',
      pricingModel: 'CPC',
      cpcEur: 0.8,
      cpmEur: null,
      cpaEur: null,
      targeting: JSON.stringify({ roles: ['shipper', 'carrier'], countries: ['DE', 'AT', 'CH'] }),
      languageTarget: JSON.stringify(['de']),
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
    },
    create: {
      id: ids.pendingCampaign,
      partnerId: partner.id,
      name: 'Beta Anzeige: Flottenservice prüfen',
      description: 'Prüfpflichtige CPC-Testkampagne für den Admin-Werbeprozess.',
      slot: 'MARKETPLACE_BANNER',
      bannerAlt: 'CargoBit Beta Anzeige Flottenservice',
      targetUrl: 'https://cargobit.eu/versicherung-partner',
      callToAction: 'Partnerangebot prüfen',
      budgetEur: 250,
      pricingModel: 'CPC',
      cpcEur: 0.8,
      targeting: JSON.stringify({ roles: ['shipper', 'carrier'], countries: ['DE', 'AT', 'CH'] }),
      languageTarget: JSON.stringify(['de']),
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'PENDING',
    },
  });

  if (includeActivePreview) {
    await prisma.partnerAdCampaign.upsert({
      where: { id: ids.activeCampaign },
      update: {
        partnerId: partner.id,
        name: 'Lokale Preview-Anzeige: Zahlungsschutz Partner',
        description: 'Nur lokal aktive CPC-Testkampagne für Banner-Render-Smoke-Tests.',
        slot: 'MARKETPLACE_BANNER',
        bannerUrl: null,
        bannerAlt: 'CargoBit lokale Preview Anzeige',
        targetUrl: 'https://cargobit.eu/zahlungsschutz',
        callToAction: 'Mehr erfahren',
        budgetEur: 100,
        spentEur: 0,
        currency: 'EUR',
        pricingModel: 'CPC',
        cpcEur: 0.5,
        cpmEur: null,
        cpaEur: null,
        targeting: JSON.stringify({ preview: true }),
        languageTarget: JSON.stringify(['de']),
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
      },
      create: {
        id: ids.activeCampaign,
        partnerId: partner.id,
        name: 'Lokale Preview-Anzeige: Zahlungsschutz Partner',
        description: 'Nur lokal aktive CPC-Testkampagne für Banner-Render-Smoke-Tests.',
        slot: 'MARKETPLACE_BANNER',
        bannerAlt: 'CargoBit lokale Preview Anzeige',
        targetUrl: 'https://cargobit.eu/zahlungsschutz',
        callToAction: 'Mehr erfahren',
        budgetEur: 100,
        pricingModel: 'CPC',
        cpcEur: 0.5,
        targeting: JSON.stringify({ preview: true }),
        languageTarget: JSON.stringify(['de']),
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });
  } else {
    await prisma.partnerAdCampaign.deleteMany({
      where: { id: ids.activeCampaign },
    });
  }

  console.log('[BetaAdsSeed] Partner:', partner.id);
  console.log('[BetaAdsSeed] Test API key:', rawApiKey);
  console.log('[BetaAdsSeed] Pending campaign:', ids.pendingCampaign);
  console.log('[BetaAdsSeed] Active local preview:', includeActivePreview ? ids.activeCampaign : 'disabled');
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

function getApiKeyPrefix(apiKey) {
  return `${apiKey.substring(0, 12)}...`;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

main()
  .catch((error) => {
    console.error('[BetaAdsSeed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
