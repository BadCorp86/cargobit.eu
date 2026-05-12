'use client';

/**
 * Badge Component
 * Status indicators with glow effects
 */

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md';
  glow?: boolean;
  className?: string;
}

const variants = {
  success: {
    bg: 'bg-[#2ECC71]/20',
    text: 'text-[#2ECC71]',
    border: 'border-[#2ECC71]/30',
    glow: 'shadow-[#2ECC71]/30',
  },
  warning: {
    bg: 'bg-[#F39C12]/20',
    text: 'text-[#F39C12]',
    border: 'border-[#F39C12]/30',
    glow: 'shadow-[#F39C12]/30',
  },
  error: {
    bg: 'bg-[#E74C3C]/20',
    text: 'text-[#E74C3C]',
    border: 'border-[#E74C3C]/30',
    glow: 'shadow-[#E74C3C]/30',
  },
  info: {
    bg: 'bg-[#00D4FF]/20',
    text: 'text-[#00D4FF]',
    border: 'border-[#00D4FF]/30',
    glow: 'shadow-[#00D4FF]/30',
  },
  default: {
    bg: 'bg-white/10',
    text: 'text-white/70',
    border: 'border-white/20',
    glow: 'shadow-white/20',
  },
};

export function Badge({ 
  children, 
  variant = 'default', 
  size = 'md',
  glow = false,
  className = '' 
}: BadgeProps) {
  const style = variants[variant];
  
  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full font-medium
        ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}
        ${style.bg} ${style.text} border ${style.border}
        ${glow ? `shadow-lg ${style.glow}` : ''}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

interface StatusDotProps {
  status: 'online' | 'offline' | 'warning';
  pulse?: boolean;
  size?: 'sm' | 'md';
}

export function StatusDot({ status, pulse = true, size = 'md' }: StatusDotProps) {
  const colors = {
    online: 'bg-[#2ECC71]',
    offline: 'bg-[#E74C3C]',
    warning: 'bg-[#F39C12]',
  };

  const glows = {
    online: 'shadow-[#2ECC71]/50',
    offline: 'shadow-[#E74C3C]/50',
    warning: 'shadow-[#F39C12]/50',
  };

  return (
    <span
      className={`
        relative inline-flex rounded-full
        ${size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'}
        ${colors[status]} shadow-lg ${glows[status]}
        ${pulse && status === 'online' ? 'animate-pulse' : ''}
      `}
    />
  );
}
