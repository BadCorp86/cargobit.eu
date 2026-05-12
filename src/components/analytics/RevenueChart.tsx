'use client';

/**
 * Revenue Chart Component
 * SVG Line Chart with Animated Gradient
 * 
 * Features:
 * - Path draw animation
 * - Animated gradient
 * - Hover point effects
 * - Smooth transitions
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  const [isAnimated, setIsAnimated] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimated(true), 500);
    return () => clearTimeout(timer);
  }, []);

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className={className}>
        <CardContent>
          <motion.div 
            className="flex items-center justify-between mb-6"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <motion.select 
                className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-[#1C7ED6]"
                whileFocus={{ scale: 1.02 }}
              >
                <option>6 Monate</option>
                <option>12 Monate</option>
                <option>Dieses Jahr</option>
              </motion.select>
            </div>
          </motion.div>

          <motion.div 
            className="flex items-baseline gap-2 mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.span 
              className="text-3xl font-bold text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {totalValue}
            </motion.span>
            {change !== undefined && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Badge variant="success" glow>
                  <motion.svg 
                    className="w-3 h-3 mr-1" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </motion.svg>
                  +{change}%
                </Badge>
              </motion.div>
            )}
          </motion.div>

          <div className="relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} className="w-full h-auto">
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgba(28, 126, 214, 0.4)" />
                  <stop offset="100%" stopColor="rgba(28, 126, 214, 0)" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1C7ED6" />
                  <stop offset="50%" stopColor="#00D4FF" />
                  <stop offset="100%" stopColor="#1C7ED6" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Grid lines */}
              {[0, 25, 50, 75, 100].map((percent, i) => (
                <motion.line
                  key={percent}
                  x1="0"
                  y1={chartHeight * (1 - percent / 100)}
                  x2={chartWidth}
                  y2={chartHeight * (1 - percent / 100)}
                  stroke="rgba(255,255,255,0.05)"
                  strokeDasharray="4 4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                />
              ))}

              {/* Animated Area */}
              <motion.path
                d={areaD}
                fill="url(#areaGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: isAnimated ? 1 : 0 }}
                transition={{ duration: 0.8 }}
              />

              {/* Animated Line */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#glow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: isAnimated ? 1 : 0 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />

              {/* Animated Points */}
              {points.map((p, i) => (
                <motion.g key={i}>
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="transparent"
                    stroke="#00D4FF"
                    strokeWidth="1"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: isAnimated ? 0.3 : 0, scale: isAnimated ? 1 : 0 }}
                    transition={{ delay: 1 + i * 0.1, duration: 0.3 }}
                  />
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r="6"
                    fill="#06121C"
                    stroke="#00D4FF"
                    strokeWidth="2"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: isAnimated ? 1 : 0, scale: isAnimated ? 1 : 0 }}
                    transition={{ delay: 1 + i * 0.1, duration: 0.3 }}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0, 212, 255, 0.5))' }}
                  />
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill="#00D4FF"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: isAnimated ? 1 : 0, scale: isAnimated ? 1 : 0 }}
                    transition={{ delay: 1.2 + i * 0.1, duration: 0.3 }}
                  />
                </motion.g>
              ))}

              {/* X-axis labels */}
              {points.map((p, i) => (
                <motion.text
                  key={i}
                  x={p.x}
                  y={chartHeight + 25}
                  textAnchor="middle"
                  className="text-xs fill-white/40"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 + i * 0.1 }}
                >
                  {p.month}
                </motion.text>
              ))}
            </svg>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
