'use client';

/**
 * Premium Topbar Component
 * Sticky Header with Search, Notifications, Actions
 */

import React, { useState } from 'react';
import { IconButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface TopbarProps {
  title?: string;
  subtitle?: string;
  onMobileMenuClick?: () => void;
  onSearch?: (query: string) => void;
  showSearch?: boolean;
  actions?: React.ReactNode;
}

export default function Topbar({
  title = 'Admin Dashboard',
  subtitle = 'Übersicht aller Systeme und Aktivitäten',
  onMobileMenuClick,
  onSearch,
  showSearch = true,
  actions,
}: TopbarProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className="sticky top-0 z-40 h-20 bg-[#06121C]/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Mobile Menu + Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          {onMobileMenuClick && (
            <button
              onClick={onMobileMenuClick}
              className="lg:hidden p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">{title}</h1>
            <p className="text-white/40 text-sm hidden sm:block">{subtitle}</p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          {showSearch && (
            <form onSubmit={handleSearch} className={`
              relative hidden md:flex items-center transition-all duration-300
              ${searchFocused ? 'w-72' : 'w-56'}
            `}>
              <div className={`
                absolute inset-0 rounded-xl bg-white/[0.05] border transition-all duration-300
                ${searchFocused ? 'border-[#1C7ED6]/50 shadow-lg shadow-[#1C7ED6]/10' : 'border-white/[0.08]'}
              `} />
              <svg className="absolute left-3 w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="relative w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </form>
          )}

          {/* Notification Button */}
          <IconButton
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            }
            badge={3}
          />

          {/* Language */}
          <button className="hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group">
            <span className="text-sm text-white/60 group-hover:text-white transition-colors">DE</span>
            <svg className="w-3 h-3 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Export Button */}
          <button className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group">
            <svg className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-sm text-white/60 group-hover:text-white transition-colors">Export</span>
          </button>

          {/* New Entry Button */}
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] text-white font-medium text-sm hover:shadow-lg hover:shadow-[#1C7ED6]/30 transition-all group">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Neuer Eintrag</span>
          </button>

          {/* Custom Actions */}
          {actions}

          {/* Logout */}
          <IconButton
            variant="danger"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            }
          />
        </div>
      </div>
    </header>
  );
}
