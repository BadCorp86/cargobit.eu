'use client';

/**
 * System Status Component
 * Service Health Monitoring with Pulsing Status Dots
 * 
 * Features:
 * - Animated pulsing status indicators
 * - Staggered reveal animation
 * - Hover glow effects
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/Card';

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

const statusConfig = {
  online: {
    color: '#2ECC71',
    bgClass: 'bg-[#2ECC71]',
    glowClass: 'shadow-[#2ECC71]/50',
  },
  offline: {
    color: '#E74C3C',
    bgClass: 'bg-[#E74C3C]',
    glowClass: 'shadow-[#E74C3C]/50',
  },
  warning: {
    color: '#F39C12',
    bgClass: 'bg-[#F39C12]',
    glowClass: 'shadow-[#F39C12]/50',
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

function PulsingStatusDot({ status }: { status: Service['status'] }) {
  const config = statusConfig[status];
  
  return (
    <span className="relative flex h-3 w-3">
      {/* Outer pulse ring */}
      {status === 'online' && (
        <motion.span
          className={`absolute inline-flex h-full w-full rounded-full ${config.bgClass} opacity-75`}
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
      {/* Core dot */}
      <motion.span
        className={`relative inline-flex rounded-full h-3 w-3 ${config.bgClass} shadow-lg ${config.glowClass}`}
        animate={status === 'online' ? {
          opacity: [1, 0.7, 1],
        } : {}}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          boxShadow: status === 'online' 
            ? `0 0 10px ${config.color}` 
            : status === 'offline'
            ? `0 0 10px ${config.color}`
            : `0 0 10px ${config.color}`,
        }}
      />
    </span>
  );
}

export default function SystemStatus({
  services = DEFAULT_SERVICES,
  title = 'System Status',
  className = '',
}: SystemStatusProps) {
  const allOnline = services.every((s) => s.status === 'online');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card className={className}>
        <CardHeader>
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <CardTitle>{title}</CardTitle>
            {allOnline && (
              <motion.span 
                className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#2ECC71]/20 text-[#2ECC71]"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                Alle online
              </motion.span>
            )}
          </motion.div>
          <motion.button 
            className="text-[#00D4FF] text-sm hover:underline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            whileHover={{ scale: 1.05 }}
          >
            Alle anzeigen
          </motion.button>
        </CardHeader>

        <CardContent className="p-0">
          <motion.div 
            className="divide-y divide-white/[0.05]"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {services.map((service, i) => {
              const config = statusConfig[service.status];
              
              return (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  whileHover={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    x: 4,
                  }}
                  className="flex items-center justify-between p-4 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <PulsingStatusDot status={service.status} />
                    <motion.span 
                      className="text-white/70 text-sm group-hover:text-white transition-colors"
                      whileHover={{ x: 2 }}
                    >
                      {service.name}
                    </motion.span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-white/40 text-xs">{service.uptime}</span>
                    <motion.span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        service.status === 'online' 
                          ? 'text-[#2ECC71] bg-[#2ECC71]/10' 
                          : service.status === 'offline'
                          ? 'text-[#E74C3C] bg-[#E74C3C]/10'
                          : 'text-[#F39C12] bg-[#F39C12]/10'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      style={{
                        boxShadow: `0 0 8px ${config.color}30`,
                      }}
                    >
                      {service.latency}
                    </motion.span>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
