'use client';

/**
 * CargoBit Modern Admin Dashboard
 * 
 * Premium Glassmorphism Design - Stripe/Uber/Linear Style
 * Dark Mode Only with Neon Glow Effects
 */

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import ModernAdminLayout from '@/components/admin/modern-admin-layout';

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  payments: {
    total: number;
    succeeded: number;
    pending: number;
    failed: number;
    totalAmountCents: number;
    refundedAmountCents: number;
  };
  disputes: {
    open: number;
    inProgress: number;
    resolved: number;
    totalRefunded: number;
  };
  users: {
    total: number;
    active: number;
    pending: number;
    blocked: number;
    newToday: number;
  };
  jobs: {
    total: number;
    active: number;
    completed: number;
    cancelled: number;
  };
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_STATS: DashboardStats = {
  payments: {
    total: 1247,
    succeeded: 1189,
    pending: 42,
    failed: 16,
    totalAmountCents: 18975000,
    refundedAmountCents: 450000,
  },
  disputes: {
    open: 8,
    inProgress: 12,
    resolved: 156,
    totalRefunded: 23000,
  },
  users: {
    total: 12458,
    active: 8934,
    pending: 412,
    blocked: 153,
    newToday: 23,
  },
  jobs: {
    total: 3842,
    active: 1842,
    completed: 1256,
    cancelled: 216,
  },
};

const ACTIVITIES = [
  { id: 1, type: 'user', title: 'Neuer Benutzer registriert', description: 'max.mueller@example.com', time: 'vor 2 Min.', color: '#1C7ED6' },
  { id: 2, type: 'transport', title: 'Transport abgeschlossen', description: 'HHG-2847 • Hamburg → München', time: 'vor 15 Min.', color: '#2ECC71' },
  { id: 3, type: 'payment', title: 'Auszahlung verarbeitet', description: '€2,450.00 an Fahrer #2847', time: 'vor 32 Min.', color: '#F39C12' },
  { id: 4, type: 'verification', title: 'Verifizierung genehmigt', description: 'Fahrer Klaus Weber', time: 'vor 1 Std.', color: '#00D4FF' },
  { id: 5, type: 'dispute', title: 'Neuer Streitfall', description: 'DIS-0847 • €1,200.00', time: 'vor 2 Std.', color: '#E74C3C' },
  { id: 6, type: 'user', title: 'Benutzer gesperrt', description: 'Verstoß gegen Nutzungsbedingungen', time: 'vor 3 Std.', color: '#E74C3C' },
  { id: 7, type: 'transport', title: 'Neuer Transport erstellt', description: 'TRN-4829 • Berlin → Wien', time: 'vor 4 Std.', color: '#1C7ED6' },
  { id: 8, type: 'payment', title: 'Einzahlung erhalten', description: '€15,000.00 von Spediteur #127', time: 'vor 5 Std.', color: '#2ECC71' },
];

const SYSTEM_STATUS = [
  { name: 'API Server', status: 'online', uptime: '99.98%', latency: '12ms' },
  { name: 'Datenbank', status: 'online', uptime: '99.99%', latency: '3ms' },
  { name: 'KI Service', status: 'online', uptime: '99.95%', latency: '45ms' },
  { name: 'Payment Gateway', status: 'online', uptime: '99.97%', latency: '89ms' },
  { name: 'Email Service', status: 'online', uptime: '99.90%', latency: '156ms' },
];

const EUROPE_CITIES = [
  { name: 'Hamburg', x: 48, y: 35, active: true, transports: 12 },
  { name: 'Paris', x: 32, y: 55, active: true, transports: 8 },
  { name: 'Warschau', x: 72, y: 40, active: true, transports: 15 },
  { name: 'Mailand', x: 50, y: 70, active: true, transports: 6 },
  { name: 'Barcelona', x: 25, y: 78, active: true, transports: 9 },
  { name: 'München', x: 52, y: 50, active: true, transports: 11 },
];

const TRANSPORT_ROUTES = [
  { from: 'Hamburg', to: 'München', progress: 65 },
  { from: 'Paris', to: 'Mailand', progress: 42 },
  { from: 'Warschau', to: 'Hamburg', progress: 88 },
  { from: 'Barcelona', to: 'Paris', progress: 23 },
  { from: 'München', to: 'Mailand', progress: 75 },
];

// ============================================
// KPI CARD COMPONENT
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'cyan';
  miniChartData?: number[];
}

function KPICard({ title, value, change, changeLabel, icon, color, miniChartData }: KPICardProps) {
  const colorStyles = {
    blue: { glow: 'shadow-[#1C7ED6]/30', bg: 'from-[#1C7ED6]/20 to-[#1C7ED6]/5', icon: 'bg-[#1C7ED6]/20 text-[#1C7ED6]', trend: 'text-[#1C7ED6]' },
    green: { glow: 'shadow-[#2ECC71]/30', bg: 'from-[#2ECC71]/20 to-[#2ECC71]/5', icon: 'bg-[#2ECC71]/20 text-[#2ECC71]', trend: 'text-[#2ECC71]' },
    purple: { glow: 'shadow-[#9B59B6]/30', bg: 'from-[#9B59B6]/20 to-[#9B59B6]/5', icon: 'bg-[#9B59B6]/20 text-[#9B59B6]', trend: 'text-[#9B59B6]' },
    yellow: { glow: 'shadow-[#F39C12]/30', bg: 'from-[#F39C12]/20 to-[#F39C12]/5', icon: 'bg-[#F39C12]/20 text-[#F39C12]', trend: 'text-[#F39C12]' },
    red: { glow: 'shadow-[#E74C3C]/30', bg: 'from-[#E74C3C]/20 to-[#E74C3C]/5', icon: 'bg-[#E74C3C]/20 text-[#E74C3C]', trend: 'text-[#E74C3C]' },
    cyan: { glow: 'shadow-[#00D4FF]/30', bg: 'from-[#00D4FF]/20 to-[#00D4FF]/5', icon: 'bg-[#00D4FF]/20 text-[#00D4FF]', trend: 'text-[#00D4FF]' },
  };

  const styles = colorStyles[color];
  const data = miniChartData || [30, 45, 35, 55, 40, 60, 50, 70, 55, 80, 65, 75];

  return (
    <div className="group relative rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-1">
      {/* Glow Effect */}
      <div className={`absolute inset-0 rounded-[18px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${styles.glow} shadow-2xl blur-xl -z-10`} />
      
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${styles.icon}`}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${change >= 0 ? 'bg-[#2ECC71]/10' : 'bg-[#E74C3C]/10'}`}>
            <svg className={`w-3 h-3 ${change >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'} ${change >= 0 ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span className={`text-xs font-semibold ${change >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'}`}>
              {Math.abs(change)}%
            </span>
          </div>
        )}
      </div>
      
      <div className="mb-3">
        <p className="text-white/40 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        {changeLabel && (
          <p className="text-white/30 text-xs mt-1">{changeLabel}</p>
        )}
      </div>
      
      {/* Mini Chart */}
      <div className="h-10 flex items-end gap-[3px]">
        {data.map((height, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm bg-gradient-to-t ${styles.bg} transition-all duration-300`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// EUROPE MAP COMPONENT
// ============================================

function EuropeMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [animationFrame, setAnimationFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(f => (f + 1) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, []);

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
      [15, 20], [25, 15], [45, 10], [65, 12], [80, 18], [85, 25],
      [88, 35], [90, 45], [85, 55], [82, 65], [75, 75], [65, 82],
      [50, 85], [35, 80], [25, 75], [18, 65], [12, 55], [10, 45],
      [12, 35], [15, 25]
    ];
    
    ctx.moveTo(europePath[0][0] * width / 100, europePath[0][1] * height / 100);
    for (let i = 1; i < europePath.length; i++) {
      ctx.lineTo(europePath[i][0] * width / 100, europePath[i][1] * height / 100);
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
      ctx.moveTo(i * width / 100, 0);
      ctx.lineTo(i * width / 100, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * height / 100);
      ctx.lineTo(width, i * height / 100);
      ctx.stroke();
    }
    
    // Draw routes with animation
    const cityPositions: Record<string, { x: number; y: number }> = {};
    EUROPE_CITIES.forEach(city => {
      cityPositions[city.name] = { x: city.x * width / 100, y: city.y * height / 100 };
    });
    
    TRANSPORT_ROUTES.forEach((route, idx) => {
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
    EUROPE_CITIES.forEach(city => {
      const x = city.x * width / 100;
      const y = city.y * height / 100;
      
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
    
  }, [animationFrame, hoveredCity]);

  return (
    <div className="relative rounded-[18px] bg-white/[0.05] border border-white/[0.08] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1C7ED6]/20">
            <svg className="w-5 h-5 text-[#1C7ED6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
      </div>
      
      {/* Map Canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={350}
          className="w-full h-auto"
        />
        
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
        
        {/* Expand Button */}
        <button className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-colors text-sm">
          Karte vergrößern
        </button>
      </div>
      
      {/* Legend */}
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
    </div>
  );
}

// ============================================
// REVENUE CHART COMPONENT
// ============================================

function RevenueChart() {
  const data = [
    { month: 'Dez', value: 180000 },
    { month: 'Jan', value: 195000 },
    { month: 'Feb', value: 210000 },
    { month: 'Mär', value: 198000 },
    { month: 'Apr', value: 225000 },
    { month: 'Mai', value: 234500 },
  ];

  const maxValue = Math.max(...data.map(d => d.value));
  const chartHeight = 200;
  const chartWidth = 500;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * chartWidth;
    const y = chartHeight - (d.value / maxValue) * chartHeight;
    return { x, y, value: d.value, month: d.month };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <div className="rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold text-lg">Umsatz Übersicht</h3>
          <p className="text-white/40 text-sm">Monatliche Entwicklung</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-[#1C7ED6]">
            <option>6 Monate</option>
            <option>12 Monate</option>
            <option>Dieses Jahr</option>
          </select>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-bold text-white">€1,234,567</span>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2ECC71]/10">
          <svg className="w-3 h-3 text-[#2ECC71]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-xs font-semibold text-[#2ECC71]">+23.6%</span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="w-full h-auto">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(28, 126, 214, 0.3)" />
              <stop offset="100%" stopColor="rgba(28, 126, 214, 0)" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1C7ED6" />
              <stop offset="50%" stopColor="#00D4FF" />
              <stop offset="100%" stopColor="#1C7ED6" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(percent => (
            <line
              key={percent}
              x1="0"
              y1={chartHeight * (1 - percent / 100)}
              x2={chartWidth}
              y2={chartHeight * (1 - percent / 100)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="4 4"
            />
          ))}
          
          {/* Area */}
          <path d={areaD} fill="url(#areaGradient)" />
          
          {/* Line */}
          <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          
          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="6" fill="#06121C" stroke="#00D4FF" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="3" fill="#00D4FF" />
            </g>
          ))}
          
          {/* X-axis labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={chartHeight + 25}
              textAnchor="middle"
              className="text-xs fill-white/40"
            >
              {p.month}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ============================================
// QUICK ACTIONS COMPONENT
// ============================================

function QuickActions() {
  const actions = [
    { label: 'Neuen Transport erstellen', icon: 'truck', color: '#1C7ED6', href: '/admin/transports/new' },
    { label: 'Benutzer einladen', icon: 'user-plus', color: '#2ECC71', href: '/admin/users/invite' },
    { label: 'Verifizierung prüfen', icon: 'check', color: '#F39C12', href: '/admin/verifications' },
    { label: 'Bericht generieren', icon: 'report', color: '#9B59B6', href: '/admin/reports' },
  ];

  const icons = {
    truck: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    'user-plus': (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    check: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    report: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  };

  return (
    <div className="rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5">
      <h3 className="text-white font-semibold mb-4">Schnellaktionen</h3>
      <div className="space-y-2">
        {actions.map((action, i) => (
          <button
            key={i}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-transparent hover:border-white/[0.08] transition-all group"
          >
            <div
              className="p-2 rounded-lg transition-all group-hover:scale-110"
              style={{ backgroundColor: `${action.color}20`, color: action.color }}
            >
              {icons[action.icon as keyof typeof icons]}
            </div>
            <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors">
              {action.label}
            </span>
            <svg className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ACTIVITIES LIST COMPONENT
// ============================================

function ActivitiesList() {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'transport':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        );
      case 'payment':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'verification':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'dispute':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Letzte Aktivitäten</h3>
        <button className="text-[#00D4FF] text-sm hover:underline">Alle anzeigen</button>
      </div>
      
      <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {ACTIVITIES.map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group"
          >
            <div
              className="p-2 rounded-lg mt-0.5"
              style={{ backgroundColor: `${activity.color}20`, color: activity.color }}
            >
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium group-hover:text-[#00D4FF] transition-colors">
                {activity.title}
              </p>
              <p className="text-white/40 text-xs truncate">{activity.description}</p>
            </div>
            <span className="text-white/30 text-xs whitespace-nowrap">{activity.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// TRANSPORT STATUS DONUT CHART
// ============================================

function TransportStatusChart() {
  const data = [
    { label: 'Unterwegs', value: 1842, color: '#1C7ED6', percent: 48 },
    { label: 'Abgeschlossen', value: 1256, color: '#2ECC71', percent: 33 },
    { label: 'Geplant', value: 528, color: '#F39C12', percent: 14 },
    { label: 'Storniert', value: 216, color: '#E74C3C', percent: 5 },
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  // Calculate stroke-dasharray for each segment
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Transporte nach Status</h3>
        <button className="text-[#00D4FF] text-sm hover:underline">Details</button>
      </div>
      
      <div className="flex items-center gap-6">
        {/* Donut Chart */}
        <div className="relative w-40 h-40 flex-shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            {data.map((segment, i) => {
              const strokeDasharray = `${(segment.percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -(cumulativePercent / 100) * circumference;
              cumulativePercent += segment.percent;
              
              return (
                <circle
                  key={i}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                  style={{ 
                    filter: `drop-shadow(0 0 8px ${segment.color}40)`,
                  }}
                />
              );
            })}
          </svg>
          
          {/* Center Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{total.toLocaleString()}</span>
            <span className="text-white/40 text-xs">Gesamt</span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex-1 space-y-3">
          {data.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-white/60 text-sm">{item.label}</span>
              </div>
              <div className="text-right">
                <span className="text-white font-medium text-sm">{item.value.toLocaleString()}</span>
                <span className="text-white/30 text-xs ml-1">({item.percent}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SYSTEM STATUS COMPONENT
// ============================================

function SystemStatus() {
  return (
    <div className="rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">System Status</h3>
        <button className="text-[#00D4FF] text-sm hover:underline">Alle anzeigen</button>
      </div>
      
      <div className="space-y-2">
        {SYSTEM_STATUS.map((system, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${system.status === 'online' ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'} ${system.status === 'online' ? 'shadow-lg shadow-[#2ECC71]/50' : ''}`} />
              <span className="text-white/70 text-sm">{system.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/40 text-xs">{system.uptime}</span>
              <span className="text-[#2ECC71] text-xs font-medium">{system.latency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// USER DISTRIBUTION CHART
// ============================================

function UserDistributionChart() {
  const data = [
    { label: 'Verlader', value: 4256, color: '#1C7ED6' },
    { label: 'Spediteure', value: 3128, color: '#2ECC71' },
    { label: 'Fahrer', value: 4532, color: '#F39C12' },
    { label: 'Dispatcher', value: 542, color: '#9B59B6' },
  ];

  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Benutzerverteilung</h3>
        <button className="text-[#00D4FF] text-sm hover:underline">Alle Benutzer</button>
      </div>
      
      <div className="space-y-4">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-sm">{item.label}</span>
              <span className="text-white font-medium text-sm">{item.value.toLocaleString()}</span>
            </div>
            <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ 
                  width: `${(item.value / maxValue) * 100}%`,
                  background: `linear-gradient(90deg, ${item.color}, ${item.color}80)`,
                  boxShadow: `0 0 12px ${item.color}40`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD PAGE
// ============================================

export default function ModernAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          setStats(MOCK_STATS);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setStats(MOCK_STATS);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <ModernAdminLayout>
        <div className="flex items-center justify-center py-32">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#1C7ED6] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-3 h-3 rounded-full bg-[#00D4FF] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-3 h-3 rounded-full bg-[#1C7ED6] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </ModernAdminLayout>
    );
  }

  return (
    <ModernAdminLayout>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <KPICard
            title="Benutzer gesamt"
            value={stats?.users.total.toLocaleString() || '0'}
            change={12.5}
            changeLabel="+23 heute"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="blue"
          />
          <KPICard
            title="Aktive Transporte"
            value={stats?.jobs.active.toLocaleString() || '0'}
            change={8.2}
            changeLabel="1,842 derzeit unterwegs"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            }
            color="green"
          />
          <KPICard
            title="Umsatz (Monat)"
            value={formatCurrency(stats?.payments.totalAmountCents || 0)}
            change={23.6}
            changeLabel="vs. letzter Monat"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="purple"
          />
          <KPICard
            title="Ausstehende Verifizierungen"
            value="47"
            change={-5.2}
            changeLabel="5 heute bearbeitet"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            color="yellow"
          />
          <KPICard
            title="Offene Streitfälle"
            value={stats?.disputes.open || '0'}
            change={-15}
            changeLabel="2 heute gelöst"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            color="red"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Map & Chart */}
          <div className="xl:col-span-2 space-y-6">
            <EuropeMap />
            <RevenueChart />
          </div>

          {/* Right Column - Quick Actions & System Status */}
          <div className="space-y-6">
            <QuickActions />
            <SystemStatus />
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activities */}
          <div className="lg:col-span-1">
            <ActivitiesList />
          </div>

          {/* Transport Status */}
          <div className="lg:col-span-1">
            <TransportStatusChart />
          </div>

          {/* User Distribution */}
          <div className="lg:col-span-1">
            <UserDistributionChart />
          </div>
        </div>
      </div>
    </ModernAdminLayout>
  );
}
