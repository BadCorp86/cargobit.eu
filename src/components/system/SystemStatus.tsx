'use client';

/**
 * System Status Component
 * Service Health Monitoring
 */

import React from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';
import { StatusDot } from '@/components/ui/Badge';

interface Service {
  name: string;
  status: 'online' | 'offline' | 'warning';
  uptime: string;
  latency: string;
}

interface SystemStatusProps {
  services?: Service[];
  title?: string;
  className?: string;
}

const DEFAULT_SERVICES: Service[] = [
  { name: 'API Server', status: 'online', uptime: '99.98%', latency: '12ms' },
  { name: 'Datenbank', status: 'online', uptime: '99.99%', latency: '3ms' },
  { name: 'KI Service', status: 'online', uptime: '99.95%', latency: '45ms' },
  { name: 'Payment Gateway', status: 'online', uptime: '99.97%', latency: '89ms' },
  { name: 'Email Service', status: 'online', uptime: '99.90%', latency: '156ms' },
];

export default function SystemStatus({
  services = DEFAULT_SERVICES,
  title = 'System Status',
  className = '',
}: SystemStatusProps) {
  const allOnline = services.every((s) => s.status === 'online');

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>{title}</CardTitle>
          {allOnline && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#2ECC71]/20 text-[#2ECC71]">
              Alle online
            </span>
          )}
        </div>
        <button className="text-[#00D4FF] text-sm hover:underline">Alle anzeigen</button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-white/[0.05]">
          {services.map((service, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <StatusDot status={service.status} />
                <span className="text-white/70 text-sm">{service.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white/40 text-xs">{service.uptime}</span>
                <span
                  className={`text-xs font-medium ${
                    service.status === 'online' ? 'text-[#2ECC71]' : 'text-[#E74C3C]'
                  }`}
                >
                  {service.latency}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
