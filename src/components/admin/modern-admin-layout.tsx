'use client';

/**
 * CargoBit Modern Admin Layout
 * 
 * Premium Glassmorphism Design - Stripe/Uber/Linear Style
 * Dark Mode Only with Neon Glow Effects
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AdminRole } from '@prisma/client';

// ============================================
// TYPES
// ============================================

interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  is2faEnabled: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  roles: AdminRole[];
  badge?: number;
  children?: NavItem[];
}

// ============================================
// NAVIGATION ITEMS
// ============================================

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    href: '/admin/dashboard',
    roles: ['ADMIN', 'FINANCE', 'SUPPORT'],
  },
  {
    id: 'transports',
    label: 'Transporte',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    href: '/admin/transports',
    roles: ['ADMIN', 'SUPPORT'],
  },
  {
    id: 'jobs',
    label: 'Aufträge',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    href: '/admin/jobs',
    roles: ['ADMIN', 'SUPPORT'],
  },
  {
    id: 'users',
    label: 'Benutzer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    href: '/admin/users',
    roles: ['ADMIN', 'SUPPORT'],
  },
  {
    id: 'drivers',
    label: 'Fahrer',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    href: '/admin/drivers',
    roles: ['ADMIN', 'SUPPORT'],
  },
  {
    id: 'vehicles',
    label: 'Fahrzeuge',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    href: '/admin/vehicles',
    roles: ['ADMIN', 'SUPPORT'],
  },
  {
    id: 'verifications',
    label: 'Verifizierungen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    href: '/admin/verifications',
    roles: ['ADMIN', 'SUPPORT'],
    badge: 47,
  },
  {
    id: 'disputes',
    label: 'Streitfälle',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    href: '/admin/disputes',
    roles: ['ADMIN', 'SUPPORT'],
    badge: 3,
  },
  {
    id: 'payments',
    label: 'Zahlungen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    href: '/admin/payments',
    roles: ['ADMIN', 'FINANCE'],
  },
  {
    id: 'reports',
    label: 'Berichte',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    href: '/admin/reports',
    roles: ['ADMIN', 'FINANCE'],
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    href: '/admin/system/settings',
    roles: ['ADMIN'],
  },
  {
    id: 'logs',
    label: 'System Logs',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: '/admin/system/logs',
    roles: ['ADMIN'],
  },
];

// ============================================
// ROLE HELPER
// ============================================

function canAccess(roles: AdminRole[], userRole: AdminRole): boolean {
  return roles.includes(userRole);
}

// ============================================
// MODERN SIDEBAR COMPONENT
// ============================================

function ModernSidebar({ user, collapsed, onToggle, mobileOpen, onMobileClose }: { 
  user: AdminUser; 
  collapsed: boolean; 
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      
      <aside className={`
        fixed left-0 top-0 h-full z-50
        transition-all duration-300 ease-out
        ${collapsed ? 'lg:w-20' : 'lg:w-[260px]'}
        w-[260px]
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      {/* Glassmorphism Background */}
      <div className="absolute inset-0 bg-[#06121C]/95 backdrop-blur-xl border-r border-white/[0.08]" />
      
      {/* Content */}
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-20 px-5 border-b border-white/[0.08]">
          {!collapsed && (
            <Link href="/admin/dashboard" className="flex items-center gap-3 group">
              {/* Logo */}
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center shadow-lg shadow-[#1C7ED6]/20 group-hover:shadow-[#1C7ED6]/40 transition-shadow duration-300">
                <span className="text-white font-bold text-lg">CB</span>
                {/* Glow Effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] opacity-50 blur-md -z-10" />
              </div>
              <div>
                <span className="text-white font-semibold text-lg tracking-tight">CargoBit</span>
                <p className="text-white/40 text-[10px] font-medium tracking-wider uppercase">Admin Panel</p>
              </div>
            </Link>
          )}
          
          {collapsed && (
            <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center shadow-lg shadow-[#1C7ED6]/20">
              <span className="text-white font-bold text-lg">CB</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {NAV_ITEMS.filter(item => canAccess(item.roles, user.role)).map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`
                  relative flex items-center gap-3 px-3 py-3 rounded-[14px] transition-all duration-200 group
                  ${isActive 
                    ? 'bg-[#1C7ED6]/20 text-white' 
                    : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                  }
                `}
                title={collapsed ? item.label : undefined}
              >
                {/* Active Glow */}
                {isActive && (
                  <>
                    <div className="absolute inset-0 rounded-[14px] bg-[#1C7ED6]/10" />
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#00D4FF] rounded-r-full shadow-lg shadow-[#00D4FF]/50" />
                  </>
                )}
                
                {/* Icon */}
                <span className={`relative z-10 ${isActive ? 'text-[#00D4FF]' : 'group-hover:text-white/80'}`}>
                  {item.icon}
                </span>
                
                {/* Label */}
                {!collapsed && (
                  <>
                    <span className="relative z-10 font-medium text-[14px] flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#E74C3C] text-white shadow-lg shadow-[#E74C3C]/30">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-white/[0.08]">
          {!collapsed ? (
            <div className="flex items-center gap-3 p-3 rounded-[14px] bg-white/[0.03] hover:bg-white/[0.05] transition-colors cursor-pointer group">
              {/* Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center text-white font-semibold">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#2ECC71] rounded-full border-2 border-[#06121C] shadow-lg shadow-[#2ECC71]/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">{user.email.split('@')[0]}</p>
                <p className="text-white/40 text-xs">{user.role}</p>
              </div>
              <svg className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </div>
          ) : (
            <div className="relative w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center text-white font-semibold cursor-pointer">
              {user.email.charAt(0).toUpperCase()}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#2ECC71] rounded-full border-2 border-[#06121C]" />
            </div>
          )}
        </div>
      </div>
      
      {/* Collapse Toggle Button - Desktop only */}
      <button 
        onClick={onToggle}
        className="absolute -right-3 top-24 w-6 h-6 rounded-full bg-[#1C7ED6] border border-white/20 flex items-center justify-center text-white hover:bg-[#00D4FF] transition-colors shadow-lg shadow-[#1C7ED6]/30 hidden lg:flex"
      >
        <svg className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
    </>
  );
}

// ============================================
// MODERN TOP BAR COMPONENT
// ============================================

interface TopBarProps {
  user: AdminUser;
  title?: string;
  subtitle?: string;
  onMobileMenuClick?: () => void;
}

function ModernTopBar({ user, title = "Admin Dashboard", subtitle = "Übersicht aller Systeme und Aktivitäten", onMobileMenuClick }: TopBarProps) {
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
      document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      router.push('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-20 bg-[#06121C]/80 backdrop-blur-xl border-b border-white/[0.08]">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Mobile Menu + Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button 
            onClick={onMobileMenuClick}
            className="lg:hidden p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">{title}</h1>
            <p className="text-white/40 text-sm hidden sm:block">{subtitle}</p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className={`
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
              className="relative w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
          </div>

          {/* Notification Button */}
          <button className="relative p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group">
            <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E74C3C] rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-[#E74C3C]/30">
              3
            </span>
          </button>

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

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-[#E74C3C]/20 hover:border-[#E74C3C]/30 transition-all group"
            title="Logout"
          >
            <svg className="w-5 h-5 text-white/60 group-hover:text-[#E74C3C] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

interface ModernAdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function ModernAdminLayout({ children, title, subtitle }: ModernAdminLayoutProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  // Fetch current admin user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/admin/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.admin);
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        console.error('Failed to fetch admin user:', error);
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06121C] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] opacity-20 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center">
              <span className="text-white font-bold text-2xl">CB</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1C7ED6] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#1C7ED6] animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#06121C]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#1C7ED6]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#00D4FF]/5 rounded-full blur-[100px]" />
      </div>

      {/* Sidebar */}
      <ModernSidebar 
        user={user} 
        collapsed={sidebarCollapsed} 
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <div className={`
        relative min-h-screen transition-all duration-300 ease-out
        ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[260px]'}
        ml-0
      `}>
        <ModernTopBar 
          user={user} 
          title={title} 
          subtitle={subtitle} 
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />
        <main className="p-4 md:p-6 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
