'use client';

/**
 * KPI Card Component
 * Premium SaaS Style with Mini Charts and Glow Effects
 */

import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'cyan';
  miniChartData?: number[];
}

const COLOR_STYLES = {
  blue: {
    glow: 'shadow-[#1C7ED6]/30',
    bg: 'from-[#1C7ED6]/20 to-[#1C7ED6]/5',
    icon: 'bg-[#1C7ED6]/20 text-[#1C7ED6]',
  },
  green: {
    glow: 'shadow-[#2ECC71]/30',
    bg: 'from-[#2ECC71]/20 to-[#2ECC71]/5',
    icon: 'bg-[#2ECC71]/20 text-[#2ECC71]',
  },
  purple: {
    glow: 'shadow-[#9B59B6]/30',
    bg: 'from-[#9B59B6]/20 to-[#9B59B6]/5',
    icon: 'bg-[#9B59B6]/20 text-[#9B59B6]',
  },
  yellow: {
    glow: 'shadow-[#F39C12]/30',
    bg: 'from-[#F39C12]/20 to-[#F39C12]/5',
    icon: 'bg-[#F39C12]/20 text-[#F39C12]',
  },
  red: {
    glow: 'shadow-[#E74C3C]/30',
    bg: 'from-[#E74C3C]/20 to-[#E74C3C]/5',
    icon: 'bg-[#E74C3C]/20 text-[#E74C3C]',
  },
  cyan: {
    glow: 'shadow-[#00D4FF]/30',
    bg: 'from-[#00D4FF]/20 to-[#00D4FF]/5',
    icon: 'bg-[#00D4FF]/20 text-[#00D4FF]',
  },
};

export function KpiCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  color = 'blue',
  miniChartData,
}: KpiCardProps) {
  const styles = COLOR_STYLES[color];
  const data = miniChartData || [30, 45, 35, 55, 40, 60, 50, 70, 55, 80, 65, 75];

  return (
    <div className="group relative rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300 hover:-translate-y-1">
      {/* Glow Effect */}
      <div
        className={`absolute inset-0 rounded-[18px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${styles.glow} shadow-2xl blur-xl -z-10`}
      />

      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${styles.icon}`}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              change >= 0 ? 'bg-[#2ECC71]/10' : 'bg-[#E74C3C]/10'
            }`}
          >
            <svg
              className={`w-3 h-3 ${
                change >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
              } ${change < 0 ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span
              className={`text-xs font-semibold ${
                change >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
              }`}
            >
              {Math.abs(change)}%
            </span>
          </div>
        )}
      </div>

      <div className="mb-3">
        <p className="text-white/40 text-sm font-medium mb-1">{title}</p>
        <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
        {changeLabel && <p className="text-white/30 text-xs mt-1">{changeLabel}</p>}
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

interface KpiGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function KpiGrid({ children, columns = 5, className = '' }: KpiGridProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 ${className}`}>
      {children}
    </div>
  );
}
