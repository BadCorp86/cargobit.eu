'use client';

/**
 * Glow Effect Components
 * Premium Neon Glow Effects for Dashboard
 * 
 * Linear, Stripe, Uber-style glow wrappers
 */

import React from 'react';

// ============================================
// BASIC GLOW WRAPPER
// ============================================

interface GlowProps {
  children: React.ReactNode;
  color?: string;
  intensity?: 'subtle' | 'medium' | 'strong';
  className?: string;
}

const intensityMap = {
  subtle: 'opacity-20 blur-lg',
  medium: 'opacity-40 blur-xl',
  strong: 'opacity-60 blur-2xl',
};

export function Glow({ 
  children, 
  color = '#00D4FF',
  intensity = 'medium',
  className = '' 
}: GlowProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow layer */}
      <div 
        className={`absolute inset-0 rounded-xl ${intensityMap[intensity]}`}
        style={{ backgroundColor: color }}
      />
      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// ============================================
// BORDER GLOW
// ============================================

interface BorderGlowProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function BorderGlow({ 
  children, 
  color = '#1C7ED6',
  className = '' 
}: BorderGlowProps) {
  return (
    <div className={`relative group ${className}`}>
      {/* Animated border glow */}
      <div 
        className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(135deg, ${color}, transparent, ${color})`,
          filter: 'blur(4px)',
        }}
      />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// ============================================
// NEON TEXT
// ============================================

interface NeonTextProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function NeonText({ 
  children, 
  color = '#00D4FF',
  className = '' 
}: NeonTextProps) {
  return (
    <span 
      className={className}
      style={{
        color,
        textShadow: `
          0 0 5px ${color},
          0 0 10px ${color},
          0 0 20px ${color},
          0 0 40px ${color}
        `,
      }}
    >
      {children}
    </span>
  );
}

// ============================================
// GLOWING DOT
// ============================================

interface GlowingDotProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const dotSizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function GlowingDot({ 
  color = '#00D4FF', 
  size = 'md',
  pulse = true,
  className = '' 
}: GlowingDotProps) {
  return (
    <span 
      className={`relative inline-flex rounded-full ${dotSizes[size]} ${className}`}
      style={{ 
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
      }}
    >
      {pulse && (
        <span 
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: color, opacity: 0.4 }}
        />
      )}
    </span>
  );
}

// ============================================
// CARD GLOW EFFECT
// ============================================

interface CardGlowProps {
  children: React.ReactNode;
  glowColor?: string;
  hoverColor?: string;
  className?: string;
}

export function CardGlow({ 
  children, 
  glowColor = 'rgba(0,212,255,0.15)',
  hoverColor = 'rgba(0,212,255,0.25)',
  className = '' 
}: CardGlowProps) {
  return (
    <div className={`relative group ${className}`}>
      {/* Background glow */}
      <div 
        className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500"
        style={{
          background: `radial-gradient(ellipse at center, ${hoverColor}, transparent 70%)`,
        }}
      />
      {/* Card content */}
      <div className="relative z-10 rounded-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ============================================
// GRADIENT GLOW
// ============================================

interface GradientGlowProps {
  children: React.ReactNode;
  from?: string;
  to?: string;
  className?: string;
}

export function GradientGlow({ 
  children, 
  from = '#1C7ED6',
  to = '#00D4FF',
  className = '' 
}: GradientGlowProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Gradient glow background */}
      <div 
        className="absolute inset-0 rounded-xl opacity-30 blur-2xl"
        style={{
          background: `linear-gradient(135deg, ${from}, ${to})`,
        }}
      />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// ============================================
// SPOTLIGHT GLOW
// ============================================

interface SpotlightGlowProps {
  children: React.ReactNode;
  className?: string;
}

export function SpotlightGlow({ 
  children, 
  className = '' 
}: SpotlightGlowProps) {
  return (
    <div className={`relative overflow-hidden group ${className}`}>
      {/* Spotlight effect */}
      <div 
        className="absolute -inset-[100%] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{
          background: 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0,212,255,0.15), transparent 50%)',
        }}
      />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// ============================================
// PULSE RING
// ============================================

interface PulseRingProps {
  color?: string;
  size?: number;
  className?: string;
}

export function PulseRing({ 
  color = '#00D4FF', 
  size = 40,
  className = '' 
}: PulseProps) {
  return (
    <span 
      className={`absolute rounded-full animate-ping ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        opacity: 0.3,
      }}
    />
  );
}

// Export all
export default {
  Glow,
  BorderGlow,
  NeonText,
  GlowingDot,
  CardGlow,
  GradientGlow,
  SpotlightGlow,
  PulseRing,
};
