'use client';

/**
 * Premium Button Component
 * Glassmorphism + Glow Effects
 */

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
}: ButtonProps) {
  const variants = {
    primary: `
      bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] text-white
      hover:shadow-lg hover:shadow-[#1C7ED6]/30
    `,
    secondary: `
      bg-white/[0.05] border border-white/[0.08] text-white/70
      hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white
    `,
    ghost: `
      bg-transparent text-white/60
      hover:bg-white/[0.05] hover:text-white
    `,
    glow: `
      bg-gradient-to-r from-[#00D4FF] to-[#1C7ED6] text-white
      shadow-lg shadow-[#00D4FF]/30
      hover:shadow-xl hover:shadow-[#00D4FF]/50
    `,
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-2',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-300
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {icon && iconPosition === 'left' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
      <span>{children}</span>
      {icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}
    </button>
  );
}

interface IconButtonProps {
  icon: React.ReactNode;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md';
  badge?: number;
  className?: string;
  onClick?: () => void;
}

export function IconButton({
  icon,
  variant = 'default',
  size = 'md',
  badge,
  className = '',
  onClick,
}: IconButtonProps) {
  const variants = {
    default: `
      bg-white/[0.05] border border-white/[0.08]
      hover:bg-white/[0.08] hover:border-white/[0.15]
      text-white/60 hover:text-white
    `,
    primary: `
      bg-[#1C7ED6]/20 border border-[#1C7ED6]/30
      hover:bg-[#1C7ED6]/30
      text-[#1C7ED6]
    `,
    danger: `
      bg-[#E74C3C]/20 border border-[#E74C3C]/30
      hover:bg-[#E74C3C]/30
      text-[#E74C3C]
    `,
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative inline-flex items-center justify-center
        rounded-xl transition-all duration-200
        ${size === 'sm' ? 'p-2' : 'p-2.5'}
        ${variants[variant]}
        ${className}
      `}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E74C3C] rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-[#E74C3C]/30">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
