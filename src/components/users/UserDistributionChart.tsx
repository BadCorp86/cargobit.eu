'use client';

/**
 * User Distribution Chart Component
 * Horizontal Bar Chart with Animation
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

interface UserData {
  label: string;
  value: number;
  color: string;
}

interface UserDistributionChartProps {
  data?: UserData[];
  title?: string;
  className?: string;
}

const DEFAULT_DATA: UserData[] = [
  { label: 'Verlader', value: 4256, color: '#1C7ED6' },
  { label: 'Spediteure', value: 3128, color: '#2ECC71' },
  { label: 'Fahrer', value: 4532, color: '#F39C12' },
  { label: 'Dispatcher', value: 542, color: '#9B59B6' },
];

export default function UserDistributionChart({
  data = DEFAULT_DATA,
  title = 'Benutzerverteilung',
  className = '',
}: UserDistributionChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <button className="text-[#00D4FF] text-sm hover:underline">Alle Benutzer</button>
      </CardHeader>

      <CardContent>
        {/* Total Count */}
        <div className="mb-6 text-center">
          <span className="text-3xl font-bold text-white">{total.toLocaleString()}</span>
          <p className="text-white/40 text-sm">Benutzer gesamt</p>
        </div>

        {/* Bar Chart */}
        <div className="space-y-4">
          {data.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-sm">{item.label}</span>
                <span className="text-white font-medium text-sm">{item.value.toLocaleString()}</span>
              </div>
              <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    background: `linear-gradient(90deg, ${item.color}, ${item.color}80)`,
                    boxShadow: `0 0 12px ${item.color}40`,
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
