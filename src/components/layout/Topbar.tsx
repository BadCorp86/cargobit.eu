'use client';

/**
 * Premium Topbar Component
 * Sticky Header with Search, Notifications, Actions
 * 
 * Features:
 * - Glassmorphism effect
 * - Animated search input
 * - Glow button effects
 * - Notification badges with pulse
 */

import React, { useState } from 'react';
import { Bell, ChevronDown, Download, LogOut, Menu, Plus, Search, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [showNotifications, setShowNotifications] = useState(false);
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/admin/login');
  };

  const notifications = [
    { id: 1, title: 'Neuer Transport erstellt', time: 'vor 2 Min.', unread: true },
    { id: 2, title: 'Verifizierung ausstehend', time: 'vor 15 Min.', unread: true },
    { id: 3, title: 'Zahlung erhalten', time: 'vor 1 Std.', unread: false },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-40 h-20 border-b border-white/[0.08] bg-[#06121C]/85 backdrop-blur-xl"
    >
      <div className="h-full px-6 flex items-center justify-between">
        {/* Left: Mobile Menu + Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          {onMobileMenuClick && (
            <motion.button
              onClick={onMobileMenuClick}
              className="lg:hidden p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Menü öffnen"
              type="button"
            >
              <Menu className="h-5 w-5 text-white" />
            </motion.button>
          )}
          <div>
            <motion.h1 
              className="text-xl font-semibold text-white tracking-tight"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              {title}
            </motion.h1>
            <motion.p 
              className="hidden text-sm text-white/40 xl:block"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {subtitle}
            </motion.p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Search */}
          {showSearch && (
            <motion.form 
              onSubmit={handleSearch} 
              className="relative hidden lg:flex items-center"
              animate={{ width: searchFocused ? 300 : 232 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="absolute inset-0 rounded-xl bg-white/[0.05] border transition-all duration-300"
                animate={{
                  borderColor: searchFocused ? 'rgba(28, 126, 214, 0.5)' : 'rgba(255, 255, 255, 0.08)',
                  boxShadow: searchFocused ? '0 0 20px rgba(28, 126, 214, 0.2)' : '0 0 0px transparent',
                }}
              />
              <Search className="absolute left-3 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="relative w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </motion.form>
          )}

          {/* Notification Button */}
          <div className="relative">
            <motion.button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Benachrichtigungen öffnen"
              type="button"
            >
              <Bell className="h-5 w-5 text-white/70" />
              {/* Notification Badge */}
              <motion.span
                className="absolute -top-1 -right-1 w-5 h-5 bg-[#E74C3C] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-[#E74C3C]/30"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                3
              </motion.span>
            </motion.button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-[#0d1f2d] border border-white/[0.08] shadow-xl shadow-black/30 overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-white/[0.08]">
                    <h3 className="text-white font-semibold text-sm">Benachrichtigungen</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notif, i) => (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`p-3 hover:bg-white/[0.05] cursor-pointer border-b border-white/[0.05] last:border-b-0 ${
                          notif.unread ? 'bg-[#1C7ED6]/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {notif.unread && (
                            <span className="w-2 h-2 rounded-full bg-[#00D4FF]" />
                          )}
                          <p className="text-white text-sm font-medium">{notif.title}</p>
                        </div>
                        <p className="text-white/40 text-xs mt-1">{notif.time}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="p-2 border-t border-white/[0.08]">
                    <button className="w-full py-2 text-center text-[#00D4FF] text-sm hover:bg-white/[0.05] rounded-lg transition-colors">
                      Alle anzeigen
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Language */}
          <motion.button 
            className="hidden xl:flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
          >
            <span className="text-sm text-white/60 group-hover:text-white transition-colors">DE</span>
            <ChevronDown className="h-3 w-3 text-white/40" />
          </motion.button>

          {/* Export Button */}
          <motion.button 
            className="hidden xl:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
          >
            <Download className="h-4 w-4 text-white/60 transition-colors group-hover:text-white" />
            <span className="text-sm text-white/60 group-hover:text-white transition-colors">Export</span>
          </motion.button>

          {/* New Entry Button */}
          <motion.button 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1C7ED6] to-[#00D4FF] text-white font-medium text-sm group relative overflow-hidden"
            whileHover={{ 
              scale: 1.02,
              boxShadow: '0 0 25px rgba(28, 126, 214, 0.4)',
            }}
            whileTap={{ scale: 0.98 }}
            type="button"
          >
            {/* Animated glow */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
            <Plus className="relative z-10 h-4 w-4" />
            <span className="hidden sm:inline relative z-10">Neuer Eintrag</span>
          </motion.button>

          <motion.div
            className="hidden xl:flex items-center gap-2 rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/10 px-3 py-2.5 text-[#00D4FF]"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-medium">AI Routing aktiv</span>
          </motion.div>

          {/* Custom Actions */}
          {actions}

          {/* Logout */}
          <motion.button
            onClick={handleLogout}
            className="p-2.5 rounded-xl bg-[#E74C3C]/10 border border-[#E74C3C]/20 hover:bg-[#E74C3C]/20 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Abmelden"
            type="button"
          >
            <LogOut className="h-5 w-5 text-[#E74C3C]" />
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}
