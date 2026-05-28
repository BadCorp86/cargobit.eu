'use client';

/**
 * Dashboard Layout Component
 * Wraps Sidebar + Topbar + Main Content
 * 
 * Features:
 * - Page transition animations
 * - Background glow effects
 * - Smooth sidebar collapse
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  requireAuth?: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  enter: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
};

export default function DashboardLayout({
  children,
  title,
  subtitle,
  requireAuth = true,
}: DashboardLayoutProps) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const adminRoleLabel = user?.role === 'ADMIN' || user?.role === 'admin' ? 'Administrator' : user?.role;

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => undefined);
    document.cookie = 'admin_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/admin/login');
  };

  // Fetch current admin user
  useEffect(() => {
    if (!requireAuth) {
      setLoading(false);
      return;
    }

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
        // For demo, set mock user
        setUser({
          id: '1',
          email: 'admin@cargobit.eu',
          name: 'Admin',
          role: 'ADMIN',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router, requireAuth]);

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#06121C] flex items-center justify-center">
        <motion.div 
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative w-16 h-16">
            <motion.div 
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] opacity-20 blur-xl"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div 
              className="relative w-16 h-16 rounded-xl bg-gradient-to-br from-[#1C7ED6] to-[#00D4FF] flex items-center justify-center"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-white font-bold text-2xl">CB</span>
            </motion.div>
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-[#1C7ED6]"
                animate={{ 
                  y: [0, -8, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
          <motion.p 
            className="text-white/40 text-sm"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Wird geladen...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // Not authenticated
  if (requireAuth && !user) {
    return null;
  }

  return (
    <div className="dark min-h-screen bg-[#06121C] text-white" style={{ colorScheme: 'dark' }}>
      {/* Premium depth background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-[linear-gradient(180deg,#06121C_0%,#071927_46%,#06121C_100%)]">
        <motion.div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(28,126,214,0.22),transparent_48%),linear-gradient(135deg,rgba(0,212,255,0.08),transparent_38%)]"
          animate={{ opacity: [0.72, 0.95, 0.72] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.9)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,18,28,0.98)_0%,rgba(6,18,28,0.22)_45%,rgba(6,18,28,0.92)_100%)]" />
      </div>

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onMobileClose={() => setMobileMenuOpen(false)}
        user={user ? {
          name: user.name || user.email.split('@')[0],
          email: user.email,
          role: adminRoleLabel || 'Administrator',
        } : undefined}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <motion.div
        className={`
          relative min-h-screen transition-[margin] duration-300 ease-out
          ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[260px]'}
          ml-0
        `}
      >
        <Topbar
          title={title}
          subtitle={subtitle}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
        />
        <AnimatePresence mode="wait">
          <motion.main
            key={title || 'dashboard'}
            variants={pageVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            className="relative p-4 sm:p-5 lg:p-6 xl:p-7"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
