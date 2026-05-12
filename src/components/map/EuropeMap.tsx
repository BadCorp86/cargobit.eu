'use client';

/**
 * Europe Map Component
 * Animated Transport Routes with Canvas
 */

import React, { useRef, useEffect, useState } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';

interface City {
  name: string;
  x: number;
  y: number;
  active: boolean;
  transports: number;
}

interface Route {
  from: string;
  to: string;
  progress: number;
}

const EUROPE_CITIES: City[] = [
  { name: 'Hamburg', x: 48, y: 35, active: true, transports: 12 },
  { name: 'Paris', x: 32, y: 55, active: true, transports: 8 },
  { name: 'Warschau', x: 72, y: 40, active: true, transports: 15 },
  { name: 'Mailand', x: 50, y: 70, active: true, transports: 6 },
  { name: 'Barcelona', x: 25, y: 78, active: true, transports: 9 },
  { name: 'München', x: 52, y: 50, active: true, transports: 11 },
];

const TRANSPORT_ROUTES: Route[] = [
  { from: 'Hamburg', to: 'München', progress: 65 },
  { from: 'Paris', to: 'Mailand', progress: 42 },
  { from: 'Warschau', to: 'Hamburg', progress: 88 },
  { from: 'Barcelona', to: 'Paris', progress: 23 },
  { from: 'München', to: 'Mailand', progress: 75 },
];

interface EuropeMapProps {
  cities?: City[];
  routes?: Route[];
  showLegend?: boolean;
  className?: string;
}

export default function EuropeMap({
  cities = EUROPE_CITIES,
  routes = TRANSPORT_ROUTES,
  showLegend = true,
  className = '',
}: EuropeMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [animationFrame, setAnimationFrame] = useState(0);

  // Animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame((f) => (f + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw map background
    ctx.fillStyle = '#0a1520';
    ctx.fillRect(0, 0, width, height);

    // Draw simplified Europe outline
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Simplified Europe shape
    const europePath = [
      [15, 20],
      [25, 15],
      [45, 10],
      [65, 12],
      [80, 18],
      [85, 25],
      [88, 35],
      [90, 45],
      [85, 55],
      [82, 65],
      [75, 75],
      [65, 82],
      [50, 85],
      [35, 80],
      [25, 75],
      [18, 65],
      [12, 55],
      [10, 45],
      [12, 35],
      [15, 25],
    ];

    ctx.moveTo(europePath[0][0] * (width / 100), europePath[0][1] * (height / 100));
    for (let i = 1; i < europePath.length; i++) {
      ctx.lineTo(europePath[i][0] * (width / 100), europePath[i][1] * (height / 100));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(28, 126, 214, 0.05)';
    ctx.fill();

    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 100; i += 10) {
      ctx.beginPath();
      ctx.moveTo((i * width) / 100, 0);
      ctx.lineTo((i * width) / 100, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * height) / 100);
      ctx.lineTo(width, (i * height) / 100);
      ctx.stroke();
    }

    // Create city position map
    const cityPositions: Record<string, { x: number; y: number }> = {};
    cities.forEach((city) => {
      cityPositions[city.name] = {
        x: (city.x * width) / 100,
        y: (city.y * height) / 100,
      };
    });

    // Draw routes with animation
    routes.forEach((route, idx) => {
      const from = cityPositions[route.from];
      const to = cityPositions[route.to];
      if (!from || !to) return;

      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, 'rgba(28, 126, 214, 0.8)');
      gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(28, 126, 214, 0.8)');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // Animated dot along route
      const progress = ((animationFrame + idx * 60) % 360) / 360;
      const dotX = from.x + (to.x - from.x) * progress;
      const dotY = from.y + (to.y - from.y) * progress;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00D4FF';
      ctx.fill();

      // Glow effect
      ctx.beginPath();
      ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.fill();
    });

    // Draw cities
    cities.forEach((city) => {
      const x = (city.x * width) / 100;
      const y = (city.y * height) / 100;

      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 212, 255, 0.15)';
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = hoveredCity === city.name ? '#00D4FF' : '#1C7ED6';
      ctx.fill();

      // Center
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Label
      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.fillText(city.name, x, y - 16);
    });
  }, [animationFrame, hoveredCity, cities, routes]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1C7ED6]/20">
            <svg className="w-5 h-5 text-[#1C7ED6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold">Live Transporte</h3>
            <p className="text-white/40 text-sm">Echtzeit Europa-Übersicht</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2ECC71]/20">
            <div className="w-2 h-2 rounded-full bg-[#2ECC71] animate-pulse" />
            <span className="text-[#2ECC71] text-xs font-medium">Live</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative">
          <canvas ref={canvasRef} width={600} height={350} className="w-full h-auto" />

          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            <button className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <button className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          </div>

          {/* Expand Button */}
          <button className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors text-sm">
            Karte vergrößern
          </button>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex items-center justify-center gap-6 p-3 border-t border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#1C7ED6]" />
              <span className="text-white/50 text-xs">Aktive Transporte</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF]" />
              <span className="text-white/50 text-xs">Route</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#00D4FF] animate-pulse" />
              <span className="text-white/50 text-xs">Fahrzeug</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
