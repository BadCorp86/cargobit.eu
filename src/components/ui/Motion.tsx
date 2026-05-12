'use client';

/**
 * Global Animation System
 * Premium SaaS Animations with Framer Motion
 * 
 * Inspired by Stripe, Linear, Uber Freight
 * Reusable motion presets for consistent UI
 */

import React from 'react';
import { motion, Variants, Transition } from 'framer-motion';

// ============================================
// FADE IN ANIMATION
// ============================================

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

const directionOffsets = {
  up: { y: 20 },
  down: { y: -20 },
  left: { x: 20 },
  right: { x: -20 },
  none: {},
};

export function FadeIn({ 
  children, 
  delay = 0, 
  duration = 0.5, 
  direction = 'up',
  className = '' 
}: FadeInProps) {
  const offset = directionOffsets[direction];
  
  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// HOVER CARD ANIMATION
// ============================================

interface HoverCardProps {
  children: React.ReactNode;
  scale?: number;
  glowColor?: string;
  className?: string;
}

export function HoverCard({ 
  children, 
  scale = 1.02,
  glowColor = 'rgba(0,212,255,0.25)',
  className = '' 
}: HoverCardProps) {
  return (
    <motion.div
      whileHover={{
        scale,
        boxShadow: `0 0 30px ${glowColor}`,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// SLIDE IN ANIMATION
// ============================================

interface SlideInProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}

const slideVariants: Record<string, Variants> = {
  left: {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0 },
  },
  up: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -30 },
    visible: { opacity: 1, y: 0 },
  },
};

export function SlideIn({ 
  children, 
  delay = 0, 
  direction = 'right',
  className = '' 
}: SlideInProps) {
  return (
    <motion.div
      variants={slideVariants[direction]}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// SCALE IN ANIMATION
// ============================================

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function ScaleIn({ 
  children, 
  delay = 0, 
  duration = 0.3,
  className = '' 
}: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// STAGGER CHILDREN CONTAINER
// ============================================

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export function StaggerContainer({ 
  children, 
  staggerDelay = 0.1,
  className = '' 
}: StaggerContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: staggerDelay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// PULSE ANIMATION
// ============================================

interface PulseProps {
  children: React.ReactNode;
  className?: string;
}

export function Pulse({ children, className = '' }: PulseProps) {
  return (
    <motion.div
      animate={{
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// GLOW PULSE ANIMATION
// ============================================

interface GlowPulseProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function GlowPulse({ 
  color = '#00D4FF', 
  size = 'md',
  className = '' 
}: GlowPulseProps) {
  return (
    <motion.span
      className={`relative inline-flex rounded-full ${sizeMap[size]} ${className}`}
      style={{ backgroundColor: color }}
      animate={{
        opacity: [1, 0.4, 1],
        boxShadow: [
          `0 0 10px ${color}`,
          `0 0 20px ${color}`,
          `0 0 10px ${color}`,
        ],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// ============================================
// ANIMATED COUNTER
// ============================================

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({ 
  value, 
  duration = 1, 
  prefix = '', 
  suffix = '',
  className = '' 
}: AnimatedCounterProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </motion.span>
  );
}

// ============================================
// PATH DRAW ANIMATION (for SVG routes)
// ============================================

interface PathDrawProps {
  d: string;
  stroke?: string;
  strokeWidth?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export function PathDraw({ 
  d, 
  stroke = '#00D4FF', 
  strokeWidth = 2,
  duration = 2,
  delay = 0,
  className = '' 
}: PathDrawProps) {
  return (
    <motion.path
      d={d}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration, delay, ease: 'easeInOut' }}
      className={className}
    />
  );
}

// ============================================
// FLOATING ANIMATION
// ============================================

interface FloatingProps {
  children: React.ReactNode;
  amplitude?: number;
  duration?: number;
  className?: string;
}

export function Floating({ 
  children, 
  amplitude = 5, 
  duration = 3,
  className = '' 
}: FloatingProps) {
  return (
    <motion.div
      animate={{
        y: [0, -amplitude, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// RIPPLE EFFECT
// ============================================

interface RippleProps {
  color?: string;
  size?: number;
  className?: string;
}

export function Ripple({ 
  color = '#00D4FF', 
  size = 60,
  className = '' 
}: RippleProps) {
  return (
    <motion.span
      className={`absolute rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
      }}
      initial={{ opacity: 0.6, scale: 0.8 }}
      animate={{
        opacity: 0,
        scale: 2,
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  );
}

// Export all components
export default {
  FadeIn,
  HoverCard,
  SlideIn,
  ScaleIn,
  StaggerContainer,
  Pulse,
  GlowPulse,
  AnimatedCounter,
  PathDraw,
  Floating,
  Ripple,
};
