import Link from 'next/link';

interface LegalPageProps {
  title: string;
  subtitle: string;
  updatedAt?: string;
  children: React.ReactNode;
}

export function LegalPage({ title, subtitle, updatedAt = '11. Juni 2026', children }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#06121C] text-white">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <Link href="/" className="text-sm text-[#00D4FF] hover:text-white">
          Zurück zu CargoBit
        </Link>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30 sm:p-10">
          <p className="text-sm uppercase tracking-[0.24em] text-[#00D4FF]">Rechtliches</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">{subtitle}</p>
          <p className="mt-4 text-sm text-slate-500">Stand: {updatedAt}</p>

          <div className="mt-8 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            Hinweis: Diese Texte sind operative Entwürfe für die Beta-Vorbereitung und müssen vor einem
            produktiven Livebetrieb durch eine qualifizierte Rechtsberatung geprüft und freigegeben werden.
          </div>

          <article className="legal-content mt-8 space-y-8 text-sm leading-7 text-slate-200">
            {children}
          </article>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-slate-300">{children}</div>
    </section>
  );
}
