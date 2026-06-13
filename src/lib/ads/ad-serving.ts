import type { AdSlotType, PartnerAdCampaign } from '@prisma/client';

export type PublicAdSlot = 'homepage-hero' | 'marketplace-sidebar' | 'order-detail-sidebar' | 'dashboard-sidebar';

const PUBLIC_SLOT_TO_DB_SLOT: Record<PublicAdSlot, AdSlotType> = {
  'homepage-hero': 'MARKETPLACE_BANNER',
  'marketplace-sidebar': 'MARKETPLACE_SIDEBAR',
  'order-detail-sidebar': 'MARKETPLACE_SIDEBAR',
  'dashboard-sidebar': 'MARKETPLACE_SIDEBAR',
};

export function normalizePublicAdSlot(slot: string | null): AdSlotType | null {
  if (!slot) return null;
  if (slot in PUBLIC_SLOT_TO_DB_SLOT) return PUBLIC_SLOT_TO_DB_SLOT[slot as PublicAdSlot];
  if (['MARKETPLACE_SIDEBAR', 'MARKETPLACE_BANNER', 'LISTING_HIGHLIGHT', 'CHECKOUT_UPSELL', 'EMAIL_SPONSOR'].includes(slot)) {
    return slot as AdSlotType;
  }
  return null;
}

export function publicSlotLabel(slot: string) {
  const labels: Record<string, string> = {
    'homepage-hero': 'Homepage Hero',
    'marketplace-sidebar': 'Marketplace Sidebar',
    'order-detail-sidebar': 'Auftragsdetail Sidebar',
    'dashboard-sidebar': 'Dashboard Sidebar',
    MARKETPLACE_SIDEBAR: 'Marketplace Sidebar',
    MARKETPLACE_BANNER: 'Marketplace Banner',
    LISTING_HIGHLIGHT: 'Gesponserter Auftrag',
    CHECKOUT_UPSELL: 'Checkout Upsell',
    EMAIL_SPONSOR: 'E-Mail Sponsor',
  };
  return labels[slot] || slot;
}

export function hasCampaignBudget(campaign: Pick<PartnerAdCampaign, 'budgetEur' | 'spentEur'>) {
  return Number(campaign.budgetEur || 0) > Number(campaign.spentEur || 0);
}

export function campaignCpc(campaign: Pick<PartnerAdCampaign, 'cpcEur'>) {
  const cpc = Number(campaign.cpcEur || 0);
  return Number.isFinite(cpc) && cpc > 0 ? cpc : 0;
}

export function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function createAdImpressionId(campaignId: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `adimp_${campaignId}_${Date.now()}_${random}`;
}

export function parseAdImpressionId(impressionId: string) {
  const parts = String(impressionId || '').split('_');
  if (parts.length < 4 || parts[0] !== 'adimp') return null;
  return {
    campaignId: parts[1],
    timestamp: Number(parts[2]),
  };
}

