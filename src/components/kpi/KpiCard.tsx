'use client';

/**
 * KPI Card Component
 * Premium SaaS Style with Animations, Glow Effects, and Mini Charts
 * 
 * Features:
 * - FadeIn animation on load
 * - HoverCard with scale and glow
 * - Animated mini charts
 * - Depth movement on hover
 */

import React from 'react';
import { motion } from 'framer-motion';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'yellow' | 'red' | 'cyan';
  miniChartData?: number[];
  delay?: number;
}

const COLOR_STYLES = {
  blue: {
    glow: 'shadow-[#1C7ED6]/30',
    glowColor: 'rgba(28, 126, 214, 0.25)',
    bg: 'from-[#1C7ED6]/20 to-[#1C7ED6]/5',
    icon: 'bg-[#1C7ED6]/20 text-[#1C7ED6]',
    chart: '#1C7ED6',
  },
  green: {
    glow: 'shadow-[#2ECC71]/30',
    glowColor: 'rgba(46, 204, 113, 0.25)',
    bg: 'from-[#2ECC71]/20 to-[#2ECC71]/5',
    icon: 'bg-[#2ECC71]/20 text-[#2ECC71]',
    chart: '#2ECC71',
  },
  purple: {
    glow: 'shadow-[#9B59B6]/30',
    glowColor: 'rgba(155, 89, 182, 0.25)',
    bg: 'from-[#9B59B6]/20 to-[#9B59B6]/5',
    icon: 'bg-[#9B59B6]/20 text-[#9B59B6]',
    chart: '#9B59B6',
  },
  yellow: {
    glow: 'shadow-[#F39C12]/30',
    glowColor: 'rgba(243, 156, 18, 0.25)',
    bg: 'from-[#F39C12]/20 to-[#F39C12]/5',
    icon: 'bg-[#F39C12]/20 text-[#F39C12]',
    chart: '#F39C12',
  },
  red: {
    glow: 'shadow-[#E74C3C]/30',
    glowColor: 'rgba(231, 76, 60, 0.25)',
    bg: 'from-[#E74C3C]/20 to-[#E74C3C]/5',
    icon: 'bg-[#E74C3C]/20 text-[#E74C3C]',
    chart: '#E74C3C',
  },
  cyan: {
    glow: 'shadow-[#00D4FF]/30',
    glowColor: 'rgba(0, 212, 255, 0.25)',
    bg: 'from-[#00D4FF]/20 to-[#00D4FF]/5',
    icon: 'bg-[#00D4FF]/20 text-[#00D4FF]',
    chart: '#00D4FF',
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
  delay = 0,
}: KpiCardProps) {
  const styles = COLOR_STYLES[color];
  const data = miniChartData || [30, 45, 35, 55, 40, 60, 50, 70, 55, 80, 65, 75];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{
        scale: 1.02,
        y: -4,
        boxShadow: `0 0 30px ${styles.glowColor}`,
      }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-[18px] bg-white/[0.05] border border-white/[0.08] p-5 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-300 cursor-pointer"
    >
      {/* Animated Glow Effect */}
      <motion.div
        className={`absolute inset-0 rounded-[18px] ${styles.glow}`}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={{ filter: 'blur(20px)' }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <motion.div 
            className={`p-3 rounded-xl ${styles.icon}`}
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            {icon}
          </motion.div>
          {change !== undefined && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.2 }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                change >= 0 ? 'bg-[#2ECC71]/10' : 'bg-[#E74C3C]/10'
              }`}
            >
              <motion.svg
                className={`w-3 h-3 ${
                  change >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
                } ${change < 0 ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </motion.svg>
              <span
                className={`text-xs font-semibold ${
                  change >= 0 ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
                }`}
              >
                {Math.abs(change)}%
              </span>
            </motion.div>
          )}
        </div>

        <div className="mb-3">
          <p className="text-white/40 text-sm font-medium mb-1">{title}</p>
          <motion.p 
            className="text-3xl font-bold text-white tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.1 }}
          >
            {value}
          </motion.p>
          {changeLabel && <p className="text-white/30 text-xs mt-1">{changeLabel}</p>}
        </div>

        {/* Animated Mini Chart */}
        <div className="h-10 flex items-end gap-[3px]">
          {data.map((height, i) => (
            <motion.div
              key={i}
              className={`flex-1 rounded-sm bg-gradient-to-t ${styles.bg}`}
              initial={{ height: 0 }}
              animate={{ height: `${height}%` }}
              transition={{ 
                duration: 0.5, 
                delay: delay + 0.1 + (i * 0.03),
                ease: 'easeOut'
              }}
              whileHover={{ 
                scale: 1.2,
                backgroundColor: styles.chart,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
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
