'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Minus, Plus, Radio, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

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
  volume: 'hoch' | 'mittel' | 'normal';
}

interface TooltipState {
  city: City;
  x: number;
  y: number;
}

interface EuropeMapProps {
  cities?: City[];
  routes?: Route[];
  showLegend?: boolean;
  className?: string;
}

const EUROPE_CITIES: City[] = [
  { name: 'Hamburg', x: 47, y: 33, active: true, transports: 12 },
  { name: 'Paris', x: 33, y: 52, active: true, transports: 8 },
  { name: 'Warschau', x: 69, y: 39, active: true, transports: 15 },
  { name: 'Mailand', x: 49, y: 67, active: true, transports: 6 },
  { name: 'Barcelona', x: 25, y: 76, active: true, transports: 9 },
  { name: 'München', x: 52, y: 51, active: true, transports: 11 },
  { name: 'Amsterdam', x: 40, y: 40, active: true, transports: 7 },
];

const TRANSPORT_ROUTES: Route[] = [
  { from: 'Hamburg', to: 'München', progress: 65, volume: 'hoch' },
  { from: 'Paris', to: 'Mailand', progress: 42, volume: 'mittel' },
  { from: 'Warschau', to: 'Hamburg', progress: 88, volume: 'hoch' },
  { from: 'Barcelona', to: 'Paris', progress: 23, volume: 'normal' },
  { from: 'München', to: 'Mailand', progress: 75, volume: 'mittel' },
  { from: 'Amsterdam', to: 'Paris', progress: 30, volume: 'normal' },
];

const EUROPE_REGIONS = [
  [
    [15, 22], [24, 16], [35, 15], [43, 21], [52, 17], [64, 20], [75, 18], [84, 26],
    [88, 38], [84, 50], [79, 57], [82, 67], [72, 73], [61, 69], [55, 80], [44, 84],
    [36, 75], [27, 78], [20, 67], [15, 58], [10, 50], [12, 39],
  ],
  [
    [43, 12], [49, 7], [57, 8], [65, 14], [69, 25], [63, 31], [54, 27], [48, 21],
  ],
  [
    [19, 42], [28, 39], [31, 47], [28, 55], [20, 56], [15, 50],
  ],
  [
    [37, 66], [43, 63], [49, 70], [47, 78], [40, 78], [35, 72],
  ],
  [
    [50, 62], [56, 66], [58, 75], [55, 82], [51, 74],
  ],
  [
    [28, 26], [32, 23], [35, 29], [34, 36], [29, 36], [26, 31],
  ],
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function quadraticPoint(
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
) {
  const inv = 1 - t;
  return {
    x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
    y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
  };
}

export default function EuropeMap({
  cities = EUROPE_CITIES,
  routes = TRANSPORT_ROUTES,
  showLegend = true,
  className = '',
}: EuropeMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 520 });
  const [animationFrame, setAnimationFrame] = useState(0);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);

  const activeTransports = useMemo(
    () => cities.reduce((sum, city) => sum + city.transports, 0),
    [cities],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const width = container.clientWidth || 900;
      const height = expanded
        ? clamp(width * 0.68, 460, 720)
        : clamp(width * 0.54, 360, 560);
      setCanvasSize({ width, height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame((frame) => (frame + 1) % 1440);
    }, 30);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvasSize;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const project = (x: number, y: number) => ({
      x: width / 2 + ((x / 100) * width - width / 2) * zoom,
      y: height / 2 + ((y / 100) * height - height / 2) * zoom,
    });

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#081827');
    background.addColorStop(0.52, '#06121C');
    background.addColorStop(1, '#03101A');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const seaGlow = ctx.createRadialGradient(width * 0.52, height * 0.18, 0, width * 0.52, height * 0.18, width * 0.72);
    seaGlow.addColorStop(0, 'rgba(0, 212, 255, 0.12)');
    seaGlow.addColorStop(0.48, 'rgba(28, 126, 214, 0.04)');
    seaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = seaGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    EUROPE_REGIONS.forEach((region, index) => {
      const firstPoint = project(region[0][0], region[0][1]);
      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);

      region.slice(1).forEach(([x, y]) => {
        const point = project(x, y);
        ctx.lineTo(point.x, point.y);
      });

      ctx.closePath();
      const landGradient = ctx.createLinearGradient(0, height * 0.2, width, height);
      landGradient.addColorStop(0, index === 0 ? 'rgba(28, 126, 214, 0.18)' : 'rgba(28, 126, 214, 0.12)');
      landGradient.addColorStop(1, 'rgba(0, 212, 255, 0.045)');
      ctx.fillStyle = landGradient;
      ctx.shadowColor = 'rgba(0, 212, 255, 0.18)';
      ctx.shadowBlur = index === 0 ? 24 : 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(139, 214, 255, 0.28)';
      ctx.lineWidth = index === 0 ? 1.4 : 1;
      ctx.stroke();
    });

    const cityPositions = cities.reduce<Record<string, { x: number; y: number }>>((acc, city) => {
      acc[city.name] = project(city.x, city.y);
      return acc;
    }, {});

    routes.forEach((route, index) => {
      const from = cityPositions[route.from];
      const to = cityPositions[route.to];
      if (!from || !to) return;

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const control = {
        x: (from.x + to.x) / 2 - dy * 0.18,
        y: (from.y + to.y) / 2 + dx * 0.18,
      };
      const routeStrength = route.volume === 'hoch' ? 1 : route.volume === 'mittel' ? 0.78 : 0.58;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
      ctx.strokeStyle = `rgba(28, 126, 214, ${0.14 + routeStrength * 0.08})`;
      ctx.lineWidth = 8 * routeStrength;
      ctx.shadowColor = 'rgba(0, 212, 255, 0.24)';
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, 'rgba(28, 126, 214, 0.15)');
      gradient.addColorStop(0.42, 'rgba(0, 212, 255, 0.95)');
      gradient.addColorStop(1, 'rgba(46, 204, 113, 0.55)');

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.1 + routeStrength;
      ctx.lineCap = 'round';
      ctx.setLineDash([12, 12]);
      ctx.lineDashOffset = -animationFrame * 0.55 - index * 8;
      ctx.shadowColor = 'rgba(0, 212, 255, 0.8)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      [0, 0.5].forEach((offset) => {
        const t = (animationFrame / 220 + index * 0.08 + offset) % 1;
        const vehicle = quadraticPoint(from, control, to, t);

        ctx.beginPath();
        ctx.arc(vehicle.x, vehicle.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.16)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(vehicle.x, vehicle.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00D4FF';
        ctx.shadowColor = '#00D4FF';
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.beginPath();
        ctx.arc(vehicle.x, vehicle.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      });
    });

    cities.forEach((city) => {
      const position = cityPositions[city.name];
      if (!position) return;

      const isHovered = hoveredCity === city.name;
      const pulse = 1 + Math.sin((animationFrame + city.x * 4) * 0.055) * 0.12;

      ctx.beginPath();
      ctx.arc(position.x, position.y, (isHovered ? 24 : 18) * pulse, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? 'rgba(0, 212, 255, 0.22)' : 'rgba(0, 212, 255, 0.12)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(position.x, position.y, isHovered ? 11 : 8, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#00D4FF' : '#1C7ED6';
      ctx.shadowColor = '#00D4FF';
      ctx.shadowBlur = isHovered ? 22 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(position.x, position.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const labelY = position.y - 23;
      const textWidth = ctx.measureText(city.name).width;

      ctx.fillStyle = 'rgba(3, 16, 26, 0.78)';
      ctx.beginPath();
      ctx.roundRect(position.x - textWidth / 2 - 8, labelY - 13, textWidth + 16, 20, 8);
      ctx.fill();

      ctx.fillStyle = isHovered ? '#00D4FF' : 'rgba(255,255,255,0.82)';
      ctx.fillText(city.name, position.x, labelY + 1);

      if (city.transports > 0) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.18)';
        ctx.beginPath();
        ctx.roundRect(position.x + 13, position.y - 19, 28, 18, 8);
        ctx.fill();
        ctx.fillStyle = '#2ECC71';
        ctx.font = '700 10px Inter, system-ui, sans-serif';
        ctx.fillText(city.transports.toString(), position.x + 27, position.y - 6);
      }
    });
  }, [animationFrame, canvasSize, cities, hoveredCity, routes, zoom]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const { width, height } = canvasSize;

    const project = (x: number, y: number) => ({
      x: width / 2 + ((x / 100) * width - width / 2) * zoom,
      y: height / 2 + ((y / 100) * height - height / 2) * zoom,
    });

    const hit = cities.find((city) => {
      const point = project(city.x, city.y);
      const distance = Math.hypot(point.x - pointerX, point.y - pointerY);
      return distance < 28;
    });

    if (hit) {
      setHoveredCity(hit.name);
      setTooltip({ city: hit, x: pointerX, y: pointerY });
      return;
    }

    setHoveredCity(null);
    setTooltip(null);
  };

  const connectedRoutes = tooltip
    ? routes.filter((route) => route.from === tooltip.city.name || route.to === tooltip.city.name).slice(0, 2)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <Card className={`border-white/[0.08] bg-white/[0.045] ${className}`}>
        <CardHeader>
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="rounded-xl bg-[#1C7ED6]/20 p-2.5 text-[#00D4FF] shadow-lg shadow-[#1C7ED6]/20">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Live Europa Map</h3>
              <p className="text-sm text-white/40">{activeTransports} aktive Transporte im Netzwerk</p>
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-2 rounded-full bg-[#2ECC71]/15 px-3 py-1.5 text-[#2ECC71]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.span
              className="h-2 w-2 rounded-full bg-[#2ECC71]"
              animate={{ opacity: [1, 0.4, 1], scale: [1, 1.22, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <Radio className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Live</span>
          </motion.div>
        </CardHeader>

        <CardContent className="p-0">
          <div ref={containerRef} className="relative overflow-hidden">
            <canvas
              ref={canvasRef}
              className="block w-full cursor-crosshair"
              style={{ height: canvasSize.height }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                setHoveredCity(null);
                setTooltip(null);
              }}
            />

            {tooltip && (
              <motion.div
                className="pointer-events-none absolute z-20 w-56 rounded-2xl border border-white/[0.12] bg-[#071927]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl"
                style={{
                  left: clamp(tooltip.x + 14, 12, canvasSize.width - 240),
                  top: clamp(tooltip.y - 18, 12, canvasSize.height - 132),
                }}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{tooltip.city.name}</p>
                  <span className="rounded-full bg-[#00D4FF]/15 px-2 py-0.5 text-xs font-semibold text-[#00D4FF]">
                    {tooltip.city.transports} aktiv
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {connectedRoutes.map((route) => (
                    <div key={`${route.from}-${route.to}`} className="flex items-center justify-between text-xs">
                      <span className="text-white/55">{route.from} → {route.to}</span>
                      <span className="font-medium text-white/80">{route.progress}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div
              className="absolute bottom-4 right-4 flex flex-col gap-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <motion.button
                type="button"
                aria-label="Karte vergrößern"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/75 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
                onClick={() => setZoom((value) => clamp(Number((value + 0.08).toFixed(2)), 0.88, 1.28))}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                aria-label="Karte verkleinern"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/75 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
                onClick={() => setZoom((value) => clamp(Number((value - 0.08).toFixed(2)), 0.88, 1.28))}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <Minus className="h-4 w-4" />
              </motion.button>
            </motion.div>

            <motion.button
              type="button"
              className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white/75 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
              onClick={() => setExpanded((value) => !value)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span>{expanded ? 'Karte normal' : 'Karte vergrößern'}</span>
            </motion.button>
          </div>

          {showLegend && (
            <motion.div
              className="flex flex-wrap items-center justify-center gap-4 border-t border-white/[0.08] px-4 py-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              {[
                { color: '#1C7ED6', label: 'Hubs' },
                { color: 'linear-gradient(to right, #1C7ED6, #00D4FF)', label: 'KI Route', isGradient: true },
                { color: '#00D4FF', label: 'Fahrzeug', pulse: true },
                { color: '#2ECC71', label: 'Live Volumen', pulse: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${item.pulse ? 'animate-pulse' : ''}`}
                    style={{
                      background: item.isGradient ? item.color : item.color,
                      boxShadow: item.pulse ? `0 0 10px ${item.color}` : undefined,
                    }}
                  />
                  <span className="text-xs text-white/50">{item.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
