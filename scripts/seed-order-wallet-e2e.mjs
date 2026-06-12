#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const root = process.cwd();
loadDotEnv(path.join(root, '.env'));

const prisma = new PrismaClient();

const ids = {
  shipperUser: 'e2e_shipper',
  carrierUser: 'e2e_carrier',
  carrierCompany: 'e2e_carrier_company',
  shipperPickupAddress: 'e2e_shipper_pickup',
  shipperDeliveryAddress: 'e2e_shipper_delivery',
  carrierVehicle: 'e2e_carrier_vehicle',
  carrierDriver: 'e2e_carrier_driver',
  readyTransport: 'e2e_settlement_ready_transport',
  readyPickupAddress: 'e2e_ready_pickup',
  readyDeliveryAddress: 'e2e_ready_delivery',
  readyOffer: 'e2e_ready_offer',
  readyAssignment: 'e2e_ready_assignment',
};

const tokens = {
  shipper: `e2e_shipper_${crypto.randomBytes(24).toString('hex')}`,
  carrier: `e2e_carrier_${crypto.randomBytes(24).toString('hex')}`,
};

async function main() {
  await ensureSessionsTable();
  await ensureRole('SHIPPER_PRIVATE', 'E2E shipper role');
  await ensureRole('CARRIER', 'E2E carrier role');

  const shipper = await prisma.user.upsert({
    where: { id: ids.shipperUser },
    update: {
      email: 'e2e.shipper@cargobit.local',
      firstName: 'E2E',
      lastName: 'Verlader',
      status: 'ACTIVE',
    },
    create: {
      id: ids.shipperUser,
      email: 'e2e.shipper@cargobit.local',
      passwordHash: 'e2e-seeded-user',
      firstName: 'E2E',
      lastName: 'Verlader',
      status: 'ACTIVE',
    },
  });

  const carrier = await prisma.user.upsert({
    where: { id: ids.carrierUser },
    update: {
      email: 'e2e.carrier@cargobit.local',
      firstName: 'E2E',
      lastName: 'Transporteur',
      status: 'ACTIVE',
    },
    create: {
      id: ids.carrierUser,
      email: 'e2e.carrier@cargobit.local',
      passwordHash: 'e2e-seeded-user',
      firstName: 'E2E',
      lastName: 'Transporteur',
      status: 'ACTIVE',
    },
  });

  await assignRole(shipper.id, 'SHIPPER_PRIVATE');
  await assignRole(carrier.id, 'CARRIER');

  const carrierCompany = await prisma.company.upsert({
    where: { id: ids.carrierCompany },
    update: {
      name: 'E2E Carrier GmbH',
      type: 'CARRIER',
      country: 'DE',
      status: 'ACTIVE',
    },
    create: {
      id: ids.carrierCompany,
      name: 'E2E Carrier GmbH',
      type: 'CARRIER',
      country: 'DE',
      status: 'ACTIVE',
    },
  });

  await prisma.companyUser.upsert({
    where: {
      companyId_userId: {
        companyId: carrierCompany.id,
        userId: carrier.id,
      },
    },
    update: { roleInCompany: 'owner' },
    create: {
      companyId: carrierCompany.id,
      userId: carrier.id,
      roleInCompany: 'owner',
    },
  });

  const shipperWallet = await prisma.wallet.upsert({
    where: { ownerUserId: shipper.id },
    update: {
      balance: 5000,
      reservedBalance: 0,
      currency: 'EUR',
      status: 'ACTIVE',
      totalDeposited: 5000,
    },
    create: {
      ownerUserId: shipper.id,
      balance: 5000,
      reservedBalance: 0,
      currency: 'EUR',
      status: 'ACTIVE',
      totalDeposited: 5000,
    },
  });

  const carrierWallet = await prisma.wallet.upsert({
    where: { ownerUserId: carrier.id },
    update: {
      balance: 0,
      reservedBalance: 0,
      currency: 'EUR',
      status: 'ACTIVE',
    },
    create: {
      ownerUserId: carrier.id,
      balance: 0,
      reservedBalance: 0,
      currency: 'EUR',
      status: 'ACTIVE',
    },
  });

  await resetE2EWalletActivity({
    shipperWalletId: shipperWallet.id,
    carrierWalletId: carrierWallet.id,
    carrierUserId: carrier.id,
  });

  await prisma.payoutMethod.upsert({
    where: { id: 'e2e_carrier_payout_method' },
    update: {
      walletId: carrierWallet.id,
      iban: 'DE89370400440532013000',
      holderName: 'E2E Carrier GmbH',
      bic: 'COBADEFFXXX',
      verified: true,
      isDefault: true,
      createdAt: pastBusinessDayDate(10),
    },
    create: {
      id: 'e2e_carrier_payout_method',
      walletId: carrierWallet.id,
      iban: 'DE89370400440532013000',
      holderName: 'E2E Carrier GmbH',
      bic: 'COBADEFFXXX',
      verified: true,
      isDefault: true,
      createdAt: pastBusinessDayDate(10),
    },
  });

  await prisma.verification.upsert({
    where: { id: 'e2e_carrier_kyb' },
    update: {
      userId: carrier.id,
      type: 'KYB',
      status: 'APPROVED',
      documentType: 'commercial_register',
      reviewedAt: pastBusinessDayDate(10),
      reviewedBy: 'e2e-seed',
    },
    create: {
      id: 'e2e_carrier_kyb',
      userId: carrier.id,
      type: 'KYB',
      status: 'APPROVED',
      documentType: 'commercial_register',
      reviewedAt: pastBusinessDayDate(10),
      reviewedBy: 'e2e-seed',
    },
  });

  const vehicle = await prisma.vehicle.upsert({
    where: { id: ids.carrierVehicle },
    update: {
      companyId: carrierCompany.id,
      type: 'KOEFFER',
      plateNumber: 'E2E-CB-1',
      maxPayloadKg: 3500,
      volumeM3: 18,
      status: 'ACTIVE',
    },
    create: {
      id: ids.carrierVehicle,
      companyId: carrierCompany.id,
      type: 'KOEFFER',
      plateNumber: 'E2E-CB-1',
      brand: 'Mercedes-Benz',
      model: 'Sprinter Koffer',
      maxPayloadKg: 3500,
      volumeM3: 18,
      status: 'ACTIVE',
    },
  });

  const driver = await prisma.driver.upsert({
    where: { userId: carrier.id },
    update: {
      companyId: carrierCompany.id,
      licenseClass: 'B',
      licenseExpiry: futureDate(365),
      isAvailable: true,
      ratingAvg: 4.8,
      ratingCount: 12,
    },
    create: {
      id: ids.carrierDriver,
      userId: carrier.id,
      companyId: carrierCompany.id,
      licenseClass: 'B',
      licenseExpiry: futureDate(365),
      isAvailable: true,
      ratingAvg: 4.8,
      ratingCount: 12,
    },
  });

  await prisma.driverVehicle.upsert({
    where: {
      driverId_vehicleId: {
        driverId: driver.id,
        vehicleId: vehicle.id,
      },
    },
    update: { isPrimary: true },
    create: {
      driverId: driver.id,
      vehicleId: vehicle.id,
      isPrimary: true,
    },
  });

  await seedSettlementReadyTransport({ shipper, carrier, driver, vehicle });
  await seedSessions();

  const output = {
    shipperUserId: shipper.id,
    carrierUserId: carrier.id,
    shipperToken: tokens.shipper,
    carrierToken: tokens.carrier,
    settlementReadyJobId: ids.readyTransport,
    carrierPayoutMethodId: 'e2e_carrier_payout_method',
  };

  console.log(JSON.stringify(output, null, 2));
  console.log('\nUse:');
  console.log(`RUN_ORDER_E2E=true BASE_URL=http://localhost:3000 E2E_SHIPPER_TOKEN=${tokens.shipper} E2E_CARRIER_TOKEN=${tokens.carrier} E2E_SETTLEMENT_READY_JOB_ID=${ids.readyTransport} npx playwright test tests/e2e/order-wallet-settlement.e2e.test.ts --project=api`);
}

async function resetE2EWalletActivity({ shipperWalletId, carrierWalletId, carrierUserId }) {
  await prisma.walletTransaction.deleteMany({
    where: {
      walletId: { in: [shipperWalletId, carrierWalletId] },
    },
  });

  await prisma.payout.deleteMany({
    where: { userId: carrierUserId },
  });

  await prisma.wallet.update({
    where: { id: shipperWalletId },
    data: {
      balance: 5000,
      reservedBalance: 0,
      totalDeposited: 5000,
      totalWithdrawn: 0,
    },
  });

  await prisma.wallet.update({
    where: { id: carrierWalletId },
    data: {
      balance: 0,
      reservedBalance: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
    },
  });
}

async function seedSettlementReadyTransport({ shipper, carrier, driver, vehicle }) {
  await prisma.walletTransaction.deleteMany({ where: { relatedTransportId: ids.readyTransport } });
  await prisma.notification.deleteMany({ where: { data: { contains: ids.readyTransport } } }).catch(() => undefined);
  await prisma.document.deleteMany({ where: { transportId: ids.readyTransport } });
  await prisma.offer.deleteMany({ where: { transportId: ids.readyTransport } });
  await prisma.assignment.deleteMany({ where: { transportId: ids.readyTransport } });
  await prisma.transportStatusHistory.deleteMany({ where: { transportId: ids.readyTransport } });
  await prisma.commission.deleteMany({ where: { transportId: ids.readyTransport } });
  await prisma.transportDetail.deleteMany({ where: { transportId: ids.readyTransport } });
  await prisma.transport.deleteMany({ where: { id: ids.readyTransport } });

  const pickupAddress = await upsertAddress(ids.readyPickupAddress, shipper.id, 'E2E Lager Hamburg', 'Hamburg', 'DE');
  const deliveryAddress = await upsertAddress(ids.readyDeliveryAddress, shipper.id, 'E2E Ziel München', 'München', 'DE');
  const deliveredAt = pastBusinessDayDate(5);

  await prisma.transport.create({
    data: {
      id: ids.readyTransport,
      shipperUserId: shipper.id,
      transportType: 'PALLET',
      status: 'COMPLETED',
      pickupAddressId: pickupAddress.id,
      deliveryAddressId: deliveryAddress.id,
      pickupDatetime: pastBusinessDayDate(7),
      deliveryDatetime: deliveredAt,
      deliveredAt,
      completedAt: deliveredAt,
      description: 'E2E settlement-ready transport',
      shipperBudget: 850,
      agreedPrice: 820,
      currency: 'EUR',
      transportDetail: {
        create: {
          detailsJson: JSON.stringify({ pallets: 2, e2e: true }),
          weightKg: 500,
          volumeM3: 2,
        },
      },
      assignment: {
        create: {
          id: ids.readyAssignment,
          driverId: driver.id,
          vehicleId: vehicle.id,
          assignedBy: shipper.id,
        },
      },
      offers: {
        create: {
          id: ids.readyOffer,
          driverId: driver.id,
          vehicleId: vehicle.id,
          price: 820,
          currency: 'EUR',
          status: 'ACCEPTED',
          acceptedAt: deliveredAt,
        },
      },
      documents: {
        create: [
          {
            type: 'pod',
            name: 'E2E POD',
            fileUrl: 'https://example.test/e2e-pod.pdf',
            mimeType: 'application/pdf',
            isGenerated: true,
            createdBy: carrier.id,
          },
          {
            type: 'rechnung',
            name: 'E2E Rechnung',
            fileUrl: 'https://example.test/e2e-invoice.html',
            mimeType: 'text/html',
            isGenerated: true,
            createdBy: shipper.id,
          },
        ],
      },
      commissions: {
        create: {
          plan: 'STARTER',
          commissionPercent: 14,
          commissionAmount: 114.8,
          walletFeePercent: 3.5,
          walletFeeAmount: 28.7,
        },
      },
      statusHistory: {
        create: {
          status: 'COMPLETED',
          changedBy: carrier.id,
          note: 'E2E completed transport seeded for payout release.',
          changedAt: deliveredAt,
        },
      },
    },
  });
}

async function upsertAddress(id, userId, label, city, country) {
  return prisma.address.upsert({
    where: { id },
    update: {
      userId,
      label,
      street: 'E2E Straße',
      streetNumber: '1',
      postalCode: city === 'Hamburg' ? '20095' : '80331',
      city,
      country,
    },
    create: {
      id,
      userId,
      label,
      street: 'E2E Straße',
      streetNumber: '1',
      postalCode: city === 'Hamburg' ? '20095' : '80331',
      city,
      country,
    },
  });
}

async function ensureRole(name, description) {
  return prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
}

async function assignRole(userId, roleName) {
  const role = await ensureRole(roleName, `E2E ${roleName}`);
  return prisma.userRoleRelation.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
    },
  });
}

async function seedSessions() {
  await prisma.$executeRaw`DELETE FROM sessions WHERE user_id IN (${ids.shipperUser}, ${ids.carrierUser})`;
  await insertSession(ids.shipperUser, tokens.shipper);
  await insertSession(ids.carrierUser, tokens.carrier);
}

async function insertSession(userId, token) {
  const now = new Date();
  const expiresAt = futureDate(7);
  const refreshExpiresAt = futureDate(30);
  await prisma.$executeRaw`
    INSERT INTO sessions (id, user_id, token, refresh_token, ip_address, user_agent, device_id, expires_at, refresh_expires_at, created_at, last_activity)
    VALUES (${crypto.randomUUID()}, ${userId}, ${token}, ${`refresh_${token}`}, '127.0.0.1', 'CargoBit E2E', 'e2e', ${expiresAt}, ${refreshExpiresAt}, ${now}, ${now})
  `;
}

async function ensureSessionsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      refresh_token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      device_id TEXT,
      expires_at TIMESTAMP NOT NULL,
      refresh_expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_activity TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)');
}

function futureDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function pastBusinessDayDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(10, 0, 0, 0);
  return date;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

main()
  .catch((error) => {
    console.error('[E2ESeed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
