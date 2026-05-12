'use client';

/**
 * Transport Status Chart Component
 * Donut Chart with Animation
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

interface StatusData {
  label: string;
  value: number;
  color: string;
  percent: number;
}

interface TransportStatusChartProps {
  data?: StatusData[];
  title?: string;
  className?: string;
}

const DEFAULT_DATA: StatusData[] = [
  { label: 'Unterwegs', value: 1842, color: '#1C7ED6', percent: 48 },
  { label: 'Abgeschlossen', value: 1256, color: '#2ECC71', percent: 33 },
  { label: 'Geplant', value: 528, color: '#F39C12', percent: 14 },
  { label: 'Storniert', value: 216, color: '#E74C3C', percent: 5 },
];

export default function TransportStatusChart({
  data = DEFAULT_DATA,
  title = 'Transporte nach Status',
  className = '',
}: TransportStatusChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <button className="text-[#00D4FF] text-sm hover:underline">Details</button>
      </CardHeader>

      <CardContent>
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
      </CardContent>
    </Card>
  );
}
