'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BannerAdProps {
  slot: 'homepage-hero' | 'marketplace-sidebar' | 'order-detail-sidebar' | 'dashboard-sidebar';
  className?: string;
}

// Ad slot configurations
const SLOT_CONFIG = {
  'homepage-hero': { width: 970, height: 250, label: '970×250 Billboard' },
  'marketplace-sidebar': { width: 300, height: 600, label: '300×600 Half Page' },
  'order-detail-sidebar': { width: 300, height: 250, label: '300×250 Medium Rectangle' },
  'dashboard-sidebar': { width: 300, height: 250, label: '300×250 Medium Rectangle' },
};

interface RenderedAd {
  adId: string;
  imageUrl?: string | null;
  targetUrl: string;
  alt: string;
  provider: string;
  callToAction?: string | null;
}

export function BannerAd({ slot, className }: BannerAdProps) {
  const [impressionId, setImpressionId] = React.useState<string | null>(null);
  const [ad, setAd] = React.useState<RenderedAd | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const config = SLOT_CONFIG[slot];

  // Fetch ad from API
  React.useEffect(() => {
    const fetchAd = async () => {
      try {
        const response = await fetch(`/api/ads/render?slot=${slot}`);
        if (response.ok) {
          const data = await response.json();
          setImpressionId(data.impressionId);
          setAd({
            adId: data.adId,
            imageUrl: data.imageUrl,
            targetUrl: data.targetUrl,
            alt: data.alt || 'Advertisement',
            provider: data.provider,
            callToAction: data.callToAction,
          });
          
          // Track impression
          if (data.impressionId) {
            fetch('/api/ads/impression', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ impressionId: data.impressionId }),
            }).catch(() => {});
          }
        }
      } catch {
        setAd(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAd();
  }, [slot]);

  const handleClick = async () => {
    const currentAd = ad;
    if (impressionId && currentAd) {
      try {
        await fetch('/api/ads/click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ impressionId, adId: currentAd.adId }),
        });
      } catch {
        // Silent fail for tracking
      }
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-muted/50 rounded-lg animate-pulse flex items-center justify-center',
          className
        )}
        style={{ width: '100%', aspectRatio: `${config.width}/${config.height}` }}
      >
        <span className="text-xs text-muted-foreground">Anzeige lädt...</span>
      </div>
    );
  }

  if (!ad) {
    return (
      <div className={cn('rounded-lg border border-dashed border-white/[0.08] bg-white/[0.03] p-4 text-center', className)}>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">Anzeige</p>
        <p className="mt-2 text-sm text-white/55">Werbefläche verfügbar</p>
      </div>
    );
  }

  return (
    <div className={cn('relative rounded-lg overflow-hidden border bg-card', className)}>
      {/* Ad label */}
      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/50 rounded text-xs text-white/70">
        Anzeige
      </div>
      
      {/* Ad content */}
      <a
        href={ad.targetUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="block"
      >
        {ad.imageUrl ? (
          <Image
            src={ad.imageUrl}
            alt={ad.alt}
            width={config.width}
            height={config.height}
            className="h-auto w-full object-cover"
            unoptimized
          />
        ) : (
          <div
            className="flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
            style={{ width: '100%', aspectRatio: `${config.width}/${config.height}` }}
          >
            <div className="text-center p-4">
              <div className="text-sm font-semibold text-foreground">{ad.provider}</div>
              <div className="text-xs text-muted-foreground mt-1">{ad.alt}</div>
              {ad.callToAction ? (
                <div className="mt-3 text-xs font-semibold text-primary">{ad.callToAction}</div>
              ) : null}
            </div>
          </div>
        )}
      </a>
    </div>
  );
}

// Sponsored Listing Component
interface SponsoredListingProps {
  className?: string;
}

export function SponsoredListing({ className }: SponsoredListingProps) {
  const sponsoredOrders = [
    { id: 'SP-001', from: 'Berlin', to: 'München', price: 850, provider: 'Premium Transport' },
    { id: 'SP-002', from: 'Hamburg', to: 'Wien', price: 1200, provider: 'Express Logistics' },
  ];

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Gesponserte Aufträge</span>
        <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">Ad</span>
      </div>
      
      {sponsoredOrders.map((order) => (
        <a
          key={order.id}
          href={`/order/${order.id}`}
          className="block p-3 rounded-lg border bg-gradient-to-r from-primary/5 to-transparent hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{order.provider}</span>
            <span className="text-sm font-semibold">{order.price.toLocaleString('de-DE')} €</span>
          </div>
          <div className="text-sm font-medium">
            {order.from} → {order.to}
          </div>
        </a>
      ))}
    </div>
  );
}

export default BannerAd;
