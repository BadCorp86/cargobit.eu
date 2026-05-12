'use client';

/**
 * Glassmorphism Card Component
 * Premium SaaS Style with Glow Effects
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  glowColor?: string;
  hover?: boolean;
}

export function Card({ children, className = '', glow = false, glowColor = '#1C7ED6', hover = true }: CardProps) {
  return (
    <div
      className={`
        relative rounded-[18px] bg-white/[0.05] border border-white/[0.08] 
        backdrop-blur-xl transition-all duration-300
        ${hover ? 'hover:bg-white/[0.08] hover:border-white/[0.12] hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-[18px] opacity-0 hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl"
          style={{ boxShadow: `0 0 40px ${glowColor}40` }}
        />
      )}
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between p-4 border-b border-white/[0.08] ${className}`}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`p-5 ${className}`}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className = '' }: CardTitleProps) {
  return (
    <h3 className={`text-white font-semibold text-lg ${className}`}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className = '' }: CardDescriptionProps) {
  return (
    <p className={`text-white/40 text-sm ${className}`}>
      {children}
    </p>
  );
}
