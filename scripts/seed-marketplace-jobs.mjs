import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PREFIX = '[Marketplace-Test]';

const jobs = [
  {
    type: 'PALLET',
    from: { city: 'Hamburg', country: 'DE', postalCode: '20095', street: 'Jungfernstieg', streetNumber: '1', latitude: 53.5526, longitude: 9.9932 },
    to: { city: 'München', country: 'DE', postalCode: '80331', street: 'Marienplatz', streetNumber: '1', latitude: 48.1374, longitude: 11.5755 },
    budget: 920,
    weightKg: 2600,
    volumeM3: 18,
    description: '12 Europaletten Maschinenbauteile, trocken, stapelbar bis 2 Lagen.',
  },
  {
    type: 'CAR_TRANSPORT',
    from: { city: 'Berlin', country: 'DE', postalCode: '10115', street: 'Alexanderplatz', streetNumber: '1', latitude: 52.5219, longitude: 13.4132 },
    to: { city: 'Wien', country: 'AT', postalCode: '1010', street: 'Stephansplatz', streetNumber: '1', latitude: 48.2082, longitude: 16.3738 },
    budget: 1350,
    weightKg: 2100,
    volumeM3: 16,
    description: 'SUV fahrbereit, geschlossener Transport bevorzugt, Abholung mit Terminfenster.',
  },
  {
    type: 'COOLING',
    from: { city: 'Köln', country: 'DE', postalCode: '50667', street: 'Domkloster', streetNumber: '4', latitude: 50.9413, longitude: 6.9583 },
    to: { city: 'Amsterdam', country: 'NL', postalCode: '1012', street: 'Dam', streetNumber: '1', latitude: 52.3731, longitude: 4.8922 },
    budget: 780,
    weightKg: 1200,
    volumeM3: 8,
    description: 'Temperaturgeführte Ware, 2-8 °C, Übergabe mit Temperaturprotokoll.',
  },
  {
    type: 'OVERSIZE',
    from: { city: 'Stuttgart', country: 'DE', postalCode: '70173', street: 'Schlossplatz', streetNumber: '1', latitude: 48.7784, longitude: 9.1800 },
    to: { city: 'Zürich', country: 'CH', postalCode: '8001', street: 'Bahnhofstrasse', streetNumber: '1', latitude: 47.3769, longitude: 8.5417 },
    budget: 1680,
    weightKg: 8400,
    volumeM3: 42,
    description: 'Übermaß-Fracht, 7,2 m Länge, Genehmigung und erfahrenes Team erforderlich.',
  },
];

async function upsertRole(name, description) {
  return prisma.role.upsert({
    where: { name },
    update: { description },
    create: { name, description },
  });
}

async function upsertUserWithRole({ id, email, firstName, lastName, roleName }) {
  const role = await upsertRole(roleName, `Marketplace seed role ${roleName}`);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      status: 'ACTIVE',
    },
    create: {
      id,
      email,
      passwordHash: 'local-marketplace-seed',
      firstName,
      lastName,
      status: 'ACTIVE',
    },
  });

  await prisma.userRoleRelation.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  return user;
}

async function createAddress(input, userId) {
  return prisma.address.create({
    data: {
      userId,
      label: `${PREFIX} ${input.city}`,
      contactName: 'CargoBit Testkontakt',
      contactPhone: '+49 30 000000',
      street: input.street,
      streetNumber: input.streetNumber,
      postalCode: input.postalCode,
      city: input.city,
      country: input.country,
      latitude: input.latitude,
      longitude: input.longitude,
    },
  });
}

async function main() {
  const shipper = await upsertUserWithRole({
    id: 'seed_market_shipper',
    email: 'marketplace.shipper@cargobit.eu',
    firstName: 'Marketplace',
    lastName: 'Verlader',
    roleName: 'SHIPPER_COMPANY',
  });

  const carrier = await upsertUserWithRole({
    id: 'seed_market_carrier',
    email: 'marketplace.carrier@cargobit.eu',
    firstName: 'Marketplace',
    lastName: 'Transporteur',
    roleName: 'CARRIER',
  });

  const carrierCompany = await prisma.company.upsert({
    where: { vatNumber: 'DE-MARKETPLACE-SEED-CARRIER' },
    update: {
      name: 'CargoBit Testspedition',
      type: 'CARRIER',
      country: 'DE',
      status: 'ACTIVE',
    },
    create: {
      name: 'CargoBit Testspedition',
      type: 'CARRIER',
      country: 'DE',
      status: 'ACTIVE',
      vatNumber: 'DE-MARKETPLACE-SEED-CARRIER',
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

  const carrierDriver = await prisma.driver.upsert({
    where: { userId: carrier.id },
    update: {
      companyId: carrierCompany.id,
      isAvailable: true,
      ratingAvg: 4.8,
      ratingCount: 18,
    },
    create: {
      userId: carrier.id,
      companyId: carrierCompany.id,
      isAvailable: true,
      ratingAvg: 4.8,
      ratingCount: 18,
      internationalExperience: true,
      yearsExperience: 7,
      spokenLanguages: JSON.stringify(['de', 'en']),
    },
  });

  const carrierVehicle = await prisma.vehicle.upsert({
    where: { plateNumber: 'CB-SEED-100' },
    update: {
      companyId: carrierCompany.id,
      type: 'TIEFLADER',
      status: 'ACTIVE',
      maxPayloadKg: 24000,
      volumeM3: 90,
    },
    create: {
      companyId: carrierCompany.id,
      type: 'TIEFLADER',
      plateNumber: 'CB-SEED-100',
      brand: 'CargoBit',
      model: 'Test-Tieflader',
      maxPayloadKg: 24000,
      volumeM3: 90,
      status: 'ACTIVE',
    },
  });

  await prisma.driverVehicle.upsert({
    where: {
      driverId_vehicleId: {
        driverId: carrierDriver.id,
        vehicleId: carrierVehicle.id,
      },
    },
    update: { isPrimary: true },
    create: {
      driverId: carrierDriver.id,
      vehicleId: carrierVehicle.id,
      isPrimary: true,
    },
  });

  const oldTransports = await prisma.transport.findMany({
    where: { description: { startsWith: PREFIX } },
    select: { id: true },
  });
  const oldIds = oldTransports.map((transport) => transport.id);

  if (oldIds.length) {
    await prisma.walletTransaction.deleteMany({ where: { relatedTransportId: { in: oldIds } } });
    await prisma.offer.deleteMany({ where: { transportId: { in: oldIds } } });
    await prisma.assignment.deleteMany({ where: { transportId: { in: oldIds } } });
    await prisma.transport.deleteMany({ where: { id: { in: oldIds } } });
  }

  const shipperWallet = await prisma.wallet.upsert({
    where: { ownerUserId: shipper.id },
    update: {
      balance: 10000,
      reservedBalance: 0,
      currency: 'EUR',
      status: 'ACTIVE',
      totalDeposited: 10000,
    },
    create: {
      ownerUserId: shipper.id,
      balance: 10000,
      reservedBalance: 0,
      currency: 'EUR',
      status: 'ACTIVE',
      totalDeposited: 10000,
    },
  });

  for (const [index, job] of jobs.entries()) {
    const pickup = await createAddress(job.from, shipper.id);
    const delivery = await createAddress(job.to, shipper.id);
    const pickupDatetime = new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000);
    const deliveryDatetime = new Date(Date.now() + (index + 3) * 24 * 60 * 60 * 1000);

    const transport = await prisma.transport.create({
      data: {
        shipperUserId: shipper.id,
        transportType: job.type,
        status: 'PUBLISHED',
        pickupAddressId: pickup.id,
        deliveryAddressId: delivery.id,
        pickupDatetime,
        deliveryDatetime,
        description: `${PREFIX} ${job.description}`,
        distanceKm: 450 + index * 130,
        estimatedDuration: 360 + index * 90,
        shipperBudget: job.budget,
        currency: 'EUR',
        isInternational: job.from.country !== job.to.country,
        publishedAt: new Date(),
        transportDetail: {
          create: {
            detailsJson: JSON.stringify({
              source: 'local-marketplace-seed',
              summary: job.description,
            }),
            weightKg: job.weightKg,
            volumeM3: job.volumeM3,
            isHazmat: false,
            isFragile: job.type === 'CAR_TRANSPORT',
            specialRequirements: job.type === 'COOLING' ? 'Kühlung 2-8 °C erforderlich' : null,
          },
        },
        statusHistory: {
          create: {
            status: 'PUBLISHED',
            changedBy: shipper.id,
            note: 'Local marketplace test job published',
          },
        },
      },
    });

    const reservedAmount = Math.round(job.budget * 1.035 * 100) / 100;
    await prisma.wallet.update({
      where: { id: shipperWallet.id },
      data: { reservedBalance: { increment: reservedAmount } },
    });
    await prisma.walletTransaction.create({
      data: {
        walletId: shipperWallet.id,
        type: 'RESERVE',
        amount: reservedAmount,
        currency: 'EUR',
        relatedTransportId: transport.id,
        reference: `reservation_${transport.id}`,
        description: `Lokale Test-Reservierung fuer Marketplace-Auftrag ${transport.id}`,
        processedAt: new Date(),
      },
    });
  }

  console.log(`Created ${jobs.length} marketplace test jobs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
