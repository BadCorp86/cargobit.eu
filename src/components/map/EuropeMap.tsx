'use client';

/**
 * Europe Map Component
 * Animated Transport Routes with Canvas + Framer Motion
 * 
 * Features:
 * - Animated glow routes
 * - Pulse pins for cities
 * - Moving transport dots
 * - Premium SaaS look
 */

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  { name: 'Berlin', x: 55, y: 32, active: true, transports: 14 },
  { name: 'Amsterdam', x: 40, y: 42, active: true, transports: 7 },
];

const TRANSPORT_ROUTES: Route[] = [
  { from: 'Hamburg', to: 'München', progress: 65 },
  { from: 'Paris', to: 'Mailand', progress: 42 },
  { from: 'Warschau', to: 'Hamburg', progress: 88 },
  { from: 'Barcelona', to: 'Paris', progress: 23 },
  { from: 'München', to: 'Mailand', progress: 75 },
  { from: 'Berlin', to: 'Amsterdam', progress: 55 },
  { from: 'Amsterdam', to: 'Paris', progress: 30 },
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
    }, 30);
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

    // Draw map background with gradient
    const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width);
    bgGradient.addColorStop(0, '#0d1f2d');
    bgGradient.addColorStop(1, '#06121C');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw simplified Europe outline with glow
    ctx.strokeStyle = 'rgba(28, 126, 214, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0, 212, 255, 0.5)';
    ctx.shadowBlur = 10;
    ctx.beginPath();

    const europePath = [
      [15, 20], [25, 15], [45, 10], [65, 12], [80, 18],
      [85, 25], [88, 35], [90, 45], [85, 55], [82, 65],
      [75, 75], [65, 82], [50, 85], [35, 80], [25, 75],
      [18, 65], [12, 55], [10, 45], [12, 35], [15, 25],
    ];

    ctx.moveTo(europePath[0][0] * (width / 100), europePath[0][1] * (height / 100));
    for (let i = 1; i < europePath.length; i++) {
      ctx.lineTo(europePath[i][0] * (width / 100), europePath[i][1] * (height / 100));
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill with subtle gradient
    const fillGradient = ctx.createLinearGradient(0, 0, width, height);
    fillGradient.addColorStop(0, 'rgba(28, 126, 214, 0.08)');
    fillGradient.addColorStop(1, 'rgba(0, 212, 255, 0.03)');
    ctx.fillStyle = fillGradient;
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

    // Draw routes with animated glow
    routes.forEach((route, idx) => {
      const from = cityPositions[route.from];
      const to = cityPositions[route.to];
      if (!from || !to) return;

      // Route glow line
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      
      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, 'rgba(28, 126, 214, 0.8)');
      gradient.addColorStop(0.5, 'rgba(0, 212, 255, 0.9)');
      gradient.addColorStop(1, 'rgba(28, 126, 214, 0.8)');
      
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(0, 212, 255, 0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Animated dot along route (multiple dots for each route)
      const numDots = 2;
      for (let d = 0; d < numDots; d++) {
        const baseProgress = ((animationFrame + idx * 60 + d * 180) % 360) / 360;
        const dotX = from.x + (to.x - from.x) * baseProgress;
        const dotY = from.y + (to.y - from.y) * baseProgress;

        // Outer glow
        ctx.beginPath();
        ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.2)';
        ctx.fill();

        // Middle glow
        ctx.beginPath();
        ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.4)';
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00D4FF';
        ctx.shadowColor = '#00D4FF';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw cities with pulse effect
    cities.forEach((city) => {
      const x = (city.x * width) / 100;
      const y = (city.y * height) / 100;
      const isHovered = hoveredCity === city.name;
      const pulseScale = 1 + Math.sin(animationFrame * 0.1) * 0.1;

      // Outer pulse ring (animated)
      const pulseOpacity = 0.15 + Math.sin(animationFrame * 0.05) * 0.05;
      ctx.beginPath();
      ctx.arc(x, y, 16 * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${pulseOpacity})`;
      ctx.fill();

      // Middle glow
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 14 : 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 212, 255, 0.2)';
      ctx.fill();

      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#00D4FF' : '#1C7ED6';
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = isHovered ? 15 : 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Center bright dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Label with background
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      const labelY = y - 20;
      
      // Label background
      const textWidth = ctx.measureText(city.name).width;
      ctx.fillStyle = 'rgba(6, 18, 28, 0.8)';
      ctx.beginPath();
      ctx.roundRect(x - textWidth / 2 - 6, labelY - 10, textWidth + 12, 16, 4);
      ctx.fill();
      
      // Label text
      ctx.fillStyle = isHovered ? '#00D4FF' : 'rgba(255,255,255,0.8)';
      ctx.fillText(city.name, x, labelY);

      // Transport count badge
      if (city.transports > 0) {
        const badgeX = x + 20;
        const badgeY = y - 10;
        ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
        ctx.beginPath();
        ctx.arc(badgeX, badgeY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2ECC71';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.fillText(city.transports.toString(), badgeX, badgeY + 3);
      }
    });
  }, [animationFrame, hoveredCity, cities, routes]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <Card className={className}>
        <CardHeader>
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
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
          </motion.div>
          <motion.div 
            className="flex items-center gap-2"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2ECC71]/20">
              <motion.div 
                className="w-2 h-2 rounded-full bg-[#2ECC71]"
                animate={{ opacity: [1, 0.4, 1], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-[#2ECC71] text-xs font-medium">Live</span>
            </div>
          </motion.div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="relative">
            <canvas ref={canvasRef} width={600} height={350} className="w-full h-auto" />

            {/* Zoom Controls */}
            <motion.div 
              className="absolute bottom-4 right-4 flex flex-col gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              {['+', '-', '↔'].map((icon, i) => (
                <motion.button
                  key={i}
                  className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors flex items-center justify-center"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {icon}
                </motion.button>
              ))}
            </motion.div>

            {/* Expand Button */}
            <motion.button
              className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors text-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.02 }}
            >
              Karte vergrößern
            </motion.button>
          </div>

          {/* Legend */}
          {showLegend && (
            <motion.div 
              className="flex items-center justify-center gap-6 p-3 border-t border-white/[0.08]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              {[
                { color: '#1C7ED6', label: 'Aktive Transporte' },
                { color: 'linear-gradient(to right, #1C7ED6, #00D4FF)', label: 'Route', isGradient: true },
                { color: '#00D4FF', label: 'Fahrzeug', pulse: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div 
                    className={`w-3 h-3 rounded-full ${item.pulse ? 'animate-pulse' : ''}`}
                    style={{ 
                      background: item.isGradient ? item.color : item.color,
                      boxShadow: item.pulse ? `0 0 10px ${item.color}` : undefined
                    }}
                  />
                  <span className="text-white/50 text-xs">{item.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
