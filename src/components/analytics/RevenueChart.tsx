'use client';

/**
 * Revenue Chart Component
 * SVG Line Chart with Gradient
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface DataPoint {
  month: string;
  value: number;
}

interface RevenueChartProps {
  data?: DataPoint[];
  title?: string;
  subtitle?: string;
  totalValue?: string;
  change?: number;
  className?: string;
}

const DEFAULT_DATA: DataPoint[] = [
  { month: 'Dez', value: 180000 },
  { month: 'Jan', value: 195000 },
  { month: 'Feb', value: 210000 },
  { month: 'Mär', value: 198000 },
  { month: 'Apr', value: 225000 },
  { month: 'Mai', value: 234500 },
];

export default function RevenueChart({
  data = DEFAULT_DATA,
  title = 'Umsatz Übersicht',
  subtitle = 'Monatliche Entwicklung',
  totalValue = '€1,234,567',
  change = 23.6,
  className = '',
}: RevenueChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
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
    <Card className={className}>
      <CardContent>
        <div className="flex items-center justify-between mb-6">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
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
          <span className="text-3xl font-bold text-white">{totalValue}</span>
          {change !== undefined && (
            <Badge variant="success" glow>
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              +{change}%
            </Badge>
          )}
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
            {[0, 25, 50, 75, 100].map((percent) => (
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
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Points */}
            {points.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="6" fill="#06121C" stroke="#00D4FF" strokeWidth="2" />
                <circle cx={p.x} cy={p.y} r="3" fill="#00D4FF" />
              </g>
            ))}

            {/* X-axis labels */}
            {points.map((p, i) => (
              <text key={i} x={p.x} y={chartHeight + 25} textAnchor="middle" className="text-xs fill-white/40">
                {p.month}
              </text>
            ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
