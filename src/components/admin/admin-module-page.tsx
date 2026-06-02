'use client';

import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface AdminModulePageProps {
  title: string;
  subtitle: string;
  description: string;
  metrics: Array<{
    label: string;
    value: string;
    tone: 'blue' | 'green' | 'yellow' | 'red' | 'cyan';
  }>;
  tasks: string[];
  primaryHref?: string;
  primaryLabel?: string;
}

const toneClasses: Record<AdminModulePageProps['metrics'][number]['tone'], string> = {
  blue: 'from-[#1C7ED6]/25 to-[#1C7ED6]/5 text-[#8BC5FF] border-[#1C7ED6]/30',
  green: 'from-[#2ECC71]/25 to-[#2ECC71]/5 text-[#9EF2BC] border-[#2ECC71]/30',
  yellow: 'from-[#F39C12]/25 to-[#F39C12]/5 text-[#FFD28A] border-[#F39C12]/30',
  red: 'from-[#E74C3C]/25 to-[#E74C3C]/5 text-[#FFA59C] border-[#E74C3C]/30',
  cyan: 'from-[#00D4FF]/25 to-[#00D4FF]/5 text-[#8BEFFF] border-[#00D4FF]/30',
};

export default function AdminModulePage({
  title,
  subtitle,
  description,
  metrics,
  tasks,
  primaryHref = '/admin/dashboard',
  primaryLabel = 'Zum Dashboard',
}: AdminModulePageProps) {
  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      <div className="space-y-6">
        <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#00D4FF]">Admin Modul</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-3 text-base leading-7 text-white/65">{description}</p>
            </div>
            <Link
              href={primaryHref}
              className="inline-flex w-fit items-center rounded-xl border border-[#1C7ED6]/40 bg-[#1C7ED6]/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1C7ED6]/30"
            >
              {primaryLabel}
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-[18px] border bg-gradient-to-br p-5 ${toneClasses[metric.tone]}`}
            >
              <p className="text-sm text-white/55">{metric.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[18px] border border-white/[0.08] bg-white/[0.05] p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white">Nächste Ausbaustufe</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {tasks.map((task) => (
              <div key={task} className="rounded-xl border border-white/[0.08] bg-black/20 p-4 text-sm leading-6 text-white/70">
                {task}
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
