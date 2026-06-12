import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const shouldWrite = process.argv.includes('--write');

const plans = [
  {
    name: 'FREE',
    label: 'Start',
    monthlyFee: 0,
    yearlyFee: null,
    commissionPercent: 14,
    walletFeePercent: 3.5,
    features: {
      label: 'Start',
      maxTransports: 10,
      support: 'email',
      insurance: false,
      ads: false,
      pricesExcludeVat: true,
      vatNotice: 'zzgl. gesetzlicher MwSt.',
      features: [
        '10 Aufträge pro Monat',
        'KI-Preisrechner',
        'Angebote von Transporteuren',
        'Zahlungsschutz pro Auftrag',
        'E-Mail Support',
      ],
    },
  },
  {
    name: 'STARTER',
    label: 'Business',
    monthlyFee: 89,
    yearlyFee: null,
    commissionPercent: 12,
    walletFeePercent: 2.5,
    features: {
      label: 'Business',
      maxTransports: 30,
      support: 'priority',
      insurance: true,
      ads: false,
      pricesExcludeVat: true,
      vatNotice: 'zzgl. gesetzlicher MwSt.',
      features: [
        '30 Aufträge pro Monat',
        '12% CargoBit-Provision',
        'Priorisiertes Matching',
        'Verifizierungs- und Dokumentenprüfung',
        'Versicherungspartner anfragbar',
        'Priorisierter Support',
      ],
    },
  },
  {
    name: 'PROFESSIONAL',
    label: 'Deprecated',
    monthlyFee: 0,
    yearlyFee: null,
    commissionPercent: 12,
    walletFeePercent: 2.5,
    features: {
      deprecated: true,
      replacement: 'Business',
      maxTransports: 30,
      pricesExcludeVat: true,
      vatNotice: 'zzgl. gesetzlicher MwSt.',
    },
  },
  {
    name: 'ENTERPRISE',
    label: 'Deprecated',
    monthlyFee: 0,
    yearlyFee: null,
    commissionPercent: 12,
    walletFeePercent: 2.5,
    features: {
      deprecated: true,
      replacement: 'Business',
      maxTransports: 30,
      pricesExcludeVat: true,
      vatNotice: 'zzgl. gesetzlicher MwSt.',
    },
  },
];

function serializePlan(plan) {
  return {
    name: plan.name,
    monthlyFee: plan.monthlyFee,
    yearlyFee: plan.yearlyFee,
    currency: 'EUR',
    commissionPercent: plan.commissionPercent,
    walletFeePercent: plan.walletFeePercent,
    featuresJson: JSON.stringify(plan.features),
  };
}

async function main() {
  console.log(`[BillingPlans] Mode: ${shouldWrite ? 'write' : 'dry-run'}`);

  for (const plan of plans) {
    const data = serializePlan(plan);
    const existing = await prisma.plan.findUnique({ where: { name: plan.name } });

    if (!existing) {
      console.log(`[BillingPlans] create ${plan.name} (${plan.label})`);
    } else {
      const changes = Object.entries(data)
        .filter(([key, value]) => existing[key] !== value)
        .map(([key, value]) => `${key}: ${JSON.stringify(existing[key])} -> ${JSON.stringify(value)}`);

      if (changes.length === 0) {
        console.log(`[BillingPlans] ok ${plan.name} (${plan.label})`);
      } else {
        console.log(`[BillingPlans] update ${plan.name} (${plan.label})`);
        for (const change of changes) {
          console.log(`  - ${change}`);
        }
      }
    }

    if (shouldWrite) {
      await prisma.plan.upsert({
        where: { name: plan.name },
        create: data,
        update: data,
      });
    }
  }

  if (!shouldWrite) {
    console.log('[BillingPlans] Dry-run only. Run `npm run plans:sync` to write changes.');
  }
}

main()
  .catch((error) => {
    console.error('[BillingPlans] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
