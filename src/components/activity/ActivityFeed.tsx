'use client';

/**
 * Activity Feed Component
 * Recent Activities with Slide-In Animations
 * 
 * Features:
 * - Staggered slide-in animations
 * - Hover effects with glow
 * - Smooth transitions
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

interface Activity {
  id: number | string;
  type: 'user' | 'transport' | 'payment' | 'verification' | 'dispute';
  title: string;
  description: string;
  time: string;
}

interface ActivityFeedProps {
  items?: Activity[];
  title?: string;
  maxItems?: number;
  className?: string;
}

const DEFAULT_ACTIVITIES: Activity[] = [
  { id: 1, type: 'user', title: 'Neuer Benutzer registriert', description: 'max.mueller@example.com', time: 'vor 2 Min.' },
  { id: 2, type: 'transport', title: 'Transport abgeschlossen', description: 'HHG-2847 • Hamburg → München', time: 'vor 15 Min.' },
  { id: 3, type: 'payment', title: 'Auszahlung verarbeitet', description: '€2,450.00 an Fahrer #2847', time: 'vor 32 Min.' },
  { id: 4, type: 'verification', title: 'Verifizierung genehmigt', description: 'Fahrer Klaus Weber', time: 'vor 1 Std.' },
  { id: 5, type: 'dispute', title: 'Neuer Streitfall', description: 'DIS-0847 • €1,200.00', time: 'vor 2 Std.' },
  { id: 6, type: 'user', title: 'Benutzer gesperrt', description: 'Verstoß gegen Nutzungsbedingungen', time: 'vor 3 Std.' },
  { id: 7, type: 'transport', title: 'Neuer Transport erstellt', description: 'TRN-4829 • Berlin → Wien', time: 'vor 4 Std.' },
  { id: 8, type: 'payment', title: 'Einzahlung erhalten', description: '€15,000.00 von Spediteur #127', time: 'vor 5 Std.' },
];

const ACTIVITY_COLORS: Record<string, string> = {
  user: '#1C7ED6',
  transport: '#2ECC71',
  payment: '#F39C12',
  verification: '#00D4FF',
  dispute: '#E74C3C',
};

function ActivityIcon({ type }: { type: Activity['type'] }) {
  const color = ACTIVITY_COLORS[type];

  switch (type) {
    case 'user':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'transport':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
    case 'payment':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'verification':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case 'dispute':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    default:
      return null;
  }
}

const activityVariants = {
  hidden: { opacity: 0, x: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
};

export default function ActivityFeed({
  items = DEFAULT_ACTIVITIES,
  title = 'Letzte Aktivitäten',
  maxItems,
  className = '',
}: ActivityFeedProps) {
  const displayedItems = maxItems ? items.slice(0, maxItems) : items;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className={className}>
        <CardHeader>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <CardTitle>{title}</CardTitle>
          </motion.div>
          <motion.button 
            className="text-[#00D4FF] text-sm hover:underline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.05 }}
          >
            Alle anzeigen
          </motion.button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <AnimatePresence mode="popLayout">
              {displayedItems.map((activity, index) => {
                const color = ACTIVITY_COLORS[activity.type];

                return (
                  <motion.div
                    key={activity.id}
                    custom={index}
                    variants={activityVariants}
                    initial="hidden"
                    animate="visible"
                    layout
                    whileHover={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      x: 4,
                    }}
                    className="flex items-start gap-3 p-4 cursor-pointer group border-b border-white/[0.05] last:border-b-0"
                  >
                    <motion.div
                      className="p-2 rounded-lg mt-0.5"
                      style={{ backgroundColor: `${color}20`, color }}
                      whileHover={{ 
                        scale: 1.15, 
                        rotate: 5,
                        boxShadow: `0 0 15px ${color}40`,
                      }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <ActivityIcon type={activity.type} />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <motion.p 
                        className="text-white text-sm font-medium group-hover:text-[#00D4FF] transition-colors"
                        whileHover={{ x: 2 }}
                      >
                        {activity.title}
                      </motion.p>
                      <p className="text-white/40 text-xs truncate">{activity.description}</p>
                    </div>
                    <motion.span 
                      className="text-white/30 text-xs whitespace-nowrap"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.08 + 0.2 }}
                    >
                      {activity.time}
                    </motion.span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
