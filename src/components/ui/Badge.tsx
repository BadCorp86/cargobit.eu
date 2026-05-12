'use client';

/**
 * Badge Component
 * Status indicators with glow effects and animations
 * 
 * Features:
 * - Glow effects on hover
 * - Animated pulsing status dots
 * - Premium SaaS look
 */

import React from 'react';
import { motion } from 'framer-motion';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md';
  glow?: boolean;
  animated?: boolean;
  className?: string;
}

const variants = {
  success: {
    bg: 'bg-[#2ECC71]/20',
    text: 'text-[#2ECC71]',
    border: 'border-[#2ECC71]/30',
    glow: 'shadow-[#2ECC71]/30',
    color: '#2ECC71',
  },
  warning: {
    bg: 'bg-[#F39C12]/20',
    text: 'text-[#F39C12]',
    border: 'border-[#F39C12]/30',
    glow: 'shadow-[#F39C12]/30',
    color: '#F39C12',
  },
  error: {
    bg: 'bg-[#E74C3C]/20',
    text: 'text-[#E74C3C]',
    border: 'border-[#E74C3C]/30',
    glow: 'shadow-[#E74C3C]/30',
    color: '#E74C3C',
  },
  info: {
    bg: 'bg-[#00D4FF]/20',
    text: 'text-[#00D4FF]',
    border: 'border-[#00D4FF]/30',
    glow: 'shadow-[#00D4FF]/30',
    color: '#00D4FF',
  },
  default: {
    bg: 'bg-white/10',
    text: 'text-white/70',
    border: 'border-white/20',
    glow: 'shadow-white/20',
    color: 'rgba(255,255,255,0.7)',
  },
};

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  glow = false,
  animated = false,
  className = '' 
}: BadgeProps) {
  const style = variants[variant];
  
  return (
    <motion.span
      className={`
        inline-flex items-center justify-center rounded-full font-medium
        ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}
        ${style.bg} ${style.text} border ${style.border}
        ${glow ? `shadow-lg ${style.glow}` : ''}
        ${className}
      `}
      whileHover={glow ? { 
        scale: 1.05, 
        boxShadow: `0 0 15px ${style.color}50`,
      } : undefined}
      animate={animated ? {
        opacity: [1, 0.8, 1],
      } : undefined}
      transition={animated ? {
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      } : undefined}
    >
      {children}
    </motion.span>
  );
}

interface StatusDotProps {
  status: 'online' | 'offline' | 'warning';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const dotSizes = {
  sm: { outer: 'w-1.5 h-1.5', inner: 'w-1.5 h-1.5' },
  md: { outer: 'w-3 h-3', inner: 'w-3 h-3' },
  lg: { outer: 'w-4 h-4', inner: 'w-4 h-4' },
};

const statusColors = {
  online: {
    bg: 'bg-[#2ECC71]',
    shadow: 'shadow-[#2ECC71]/50',
    color: '#2ECC71',
  },
  offline: {
    bg: 'bg-[#E74C3C]',
    shadow: 'shadow-[#E74C3C]/50',
    color: '#E74C3C',
  },
  warning: {
    bg: 'bg-[#F39C12]',
    shadow: 'shadow-[#F39C12]/50',
    color: '#F39C12',
  },
};

export function StatusDot({ status, pulse = true, size = 'md', animated = true }: StatusDotProps) {
  const colorConfig = statusColors[status];
  const sizes = dotSizes[size];

  return (
    <span className={`relative inline-flex ${sizes.outer}`}>
      {/* Animated pulse ring */}
      {pulse && status === 'online' && animated && (
        <motion.span
          className={`absolute inline-flex h-full w-full rounded-full ${colorConfig.bg} opacity-75`}
          animate={{
            scale: [1, 2, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      
      {/* Core dot */}
      <motion.span
        className={`relative inline-flex rounded-full ${sizes.inner} ${colorConfig.bg} shadow-lg ${colorConfig.shadow}`}
        animate={animated ? {
          opacity: [1, 0.7, 1],
        } : undefined}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          boxShadow: `0 0 8px ${colorConfig.color}`,
        }}
      />
    </span>
  );
}

// Animated Badge with counter
interface AnimatedBadgeProps {
  count: number;
  variant?: 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export function AnimatedBadge({ count, variant = 'info', className = '' }: AnimatedBadgeProps) {
  return (
    <motion.span
      className={`
        inline-flex items-center justify-center rounded-full font-bold
        min-w-[20px] h-5 px-1.5 text-[10px]
        ${variants[variant].bg} ${variants[variant].text}
        ${className}
      `}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      key={count}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      style={{
        boxShadow: `0 0 10px ${variants[variant].color}40`,
      }}
    >
      {count}
    </motion.span>
  );
}
