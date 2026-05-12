'use client';

/**
 * Quick Actions Component
 * Action Buttons with Glow Effects
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
  onClick?: () => void;
}

interface QuickActionsProps {
  actions?: QuickAction[];
  title?: string;
  className?: string;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    label: 'Neuen Transport erstellen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    color: '#1C7ED6',
    href: '/admin/transports/new',
  },
  {
    label: 'Benutzer einladen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    color: '#2ECC71',
    href: '/admin/users/invite',
  },
  {
    label: 'Verifizierung prüfen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: '#F39C12',
    href: '/admin/verifications',
  },
  {
    label: 'Bericht generieren',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: '#9B59B6',
    href: '/admin/reports',
  },
];

export default function QuickActions({
  actions = DEFAULT_ACTIONS,
  title = 'Schnellaktionen',
  className = '',
}: QuickActionsProps) {
  return (
    <Card className={className}>
      <CardContent>
        <h3 className="text-white font-semibold mb-4">{title}</h3>
        <div className="space-y-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-transparent hover:border-white/[0.08] transition-all group"
            >
              <div
                className="p-2 rounded-lg transition-all group-hover:scale-110"
                style={{ backgroundColor: `${action.color}20`, color: action.color }}
              >
                {action.icon}
              </div>
              <span className="text-white/70 text-sm font-medium group-hover:text-white transition-colors">
                {action.label}
              </span>
              <svg
                className="w-4 h-4 text-white/30 ml-auto group-hover:text-white/60 group-hover:translate-x-1 transition-all"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
