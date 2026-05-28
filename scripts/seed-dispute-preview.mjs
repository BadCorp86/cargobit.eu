#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123456!';
const now = new Date();
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('[seed-dispute-preview] Failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

async function main() {
  console.log('Seeding CargoBit dispute preview data...');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Administrator' },
  });
  await prisma.role.upsert({
    where: { name: 'SHIPPER_COMPANY' },
    update: {},
    create: { name: 'SHIPPER_COMPANY', description: 'Gewerblicher Verlader' },
  });
  await prisma.role.upsert({
    where: { name: 'CARRIER' },
    update: {},
    create: { name: 'CARRIER', description: 'Spedition / Carrier' },
  });

  await prisma.adminUser.upsert({
    where: { email: 'admin@cargobit.eu' },
    update: {
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      is2faEnabled: false,
    },
    create: {
      id: 'local_admin_db',
      email: 'admin@cargobit.eu',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      is2faEnabled: false,
    },
  });

  const shipper = await prisma.user.upsert({
    where: { email: 'shipper.preview@cargobit.eu' },
    update: {
      status: 'ACTIVE',
      passwordHash,
      firstName: 'Max',
      lastName: 'Verlader',
    },
    create: {
      id: 'preview_shipper_user',
      email: 'shipper.preview@cargobit.eu',
      passwordHash,
      firstName: 'Max',
      lastName: 'Verlader',
      phone: '+49 30 1000001',
      language: 'de',
      status: 'ACTIVE',
    },
  });

  const carrier = await prisma.user.upsert({
    where: { email: 'carrier.preview@cargobit.eu' },
    update: {
      status: 'ACTIVE',
      passwordHash,
      firstName: 'Anna',
      lastName: 'Carrier',
    },
    create: {
      id: 'preview_carrier_user',
      email: 'carrier.preview@cargobit.eu',
      passwordHash,
      firstName: 'Anna',
      lastName: 'Carrier',
      phone: '+49 30 1000002',
      language: 'de',
      status: 'ACTIVE',
    },
  });

  await attachRole(shipper.id, 'SHIPPER_COMPANY');
  await attachRole(carrier.id, 'CARRIER');

  const pickup = await prisma.address.upsert({
    where: { id: 'preview_pickup_address' },
    update: {
      userId: shipper.id,
      contactName: 'Max Verlader',
      city: 'Hamburg',
      country: 'DE',
    },
    create: {
      id: 'preview_pickup_address',
      userId: shipper.id,
      label: 'Preview Pickup',
      contactName: 'Max Verlader',
      street: 'Am Sandtorkai',
      streetNumber: '1',
      postalCode: '20457',
      city: 'Hamburg',
      country: 'DE',
      latitude: 53.5413,
      longitude: 9.9849,
    },
  });

  const delivery = await prisma.address.upsert({
    where: { id: 'preview_delivery_address' },
    update: {
      userId: shipper.id,
      contactName: 'Max Verlader',
      city: 'Muenchen',
      country: 'DE',
    },
    create: {
      id: 'preview_delivery_address',
      userId: shipper.id,
      label: 'Preview Delivery',
      contactName: 'Max Verlader',
      street: 'Marienplatz',
      streetNumber: '1',
      postalCode: '80331',
      city: 'Muenchen',
      country: 'DE',
      latitude: 48.1374,
      longitude: 11.5755,
    },
  });

  await prisma.transport.upsert({
    where: { id: 'preview_transport_001' },
    update: {
      shipperUserId: shipper.id,
      pickupAddressId: pickup.id,
      deliveryAddressId: delivery.id,
      status: 'DELIVERY_DONE',
      agreedPrice: 250,
    },
    create: {
      id: 'preview_transport_001',
      shipperUserId: shipper.id,
      transportType: 'PALLET',
      status: 'DELIVERY_DONE',
      pickupAddressId: pickup.id,
      deliveryAddressId: delivery.id,
      pickupDatetime: yesterday,
      deliveryDatetime: now,
      description: 'Preview Transport mit beschaedigter Ware fuer Dispute Workflow',
      distanceKm: 790,
      estimatedDuration: 480,
      shipperBudget: 280,
      agreedPrice: 250,
      currency: 'EUR',
      publishedAt: yesterday,
      assignedAt: yesterday,
      pickedUpAt: yesterday,
      deliveredAt: now,
    },
  });

  await prisma.payment.upsert({
    where: { paymentIntentId: 'pi_preview_dispute_001' },
    update: {
      jobId: 'preview_transport_001',
      shipperId: shipper.id,
      transporterId: carrier.id,
      amountCents: 25_000,
      platformFeeCents: 2_500,
      transporterAmountCents: 22_500,
      status: 'SUCCEEDED',
      paymentType: 'CARD',
      paidAt: now,
      succeededAt: now,
    },
    create: {
      id: 'preview_payment_001',
      jobId: 'preview_transport_001',
      shipperId: shipper.id,
      transporterId: carrier.id,
      paymentIntentId: 'pi_preview_dispute_001',
      chargeId: 'ch_preview_dispute_001',
      amountCents: 25_000,
      currency: 'EUR',
      platformFeeCents: 2_500,
      transporterAmountCents: 22_500,
      status: 'SUCCEEDED',
      paymentType: 'CARD',
      description: 'Preview payment for dispute workflow',
      paidAt: now,
      succeededAt: now,
    },
  });

  await prisma.dispute.upsert({
    where: { id: 'dispute_1' },
    update: {
      jobId: 'preview_transport_001',
      createdById: shipper.id,
      againstId: carrier.id,
      status: 'OPEN',
      reason: 'Waren beschaedigt angekommen',
      subject: 'Beschaedigte Palettenware',
      description:
        'Mehrere Kartons waren bei Zustellung aufgerissen. Fotos und CMR sollen im Workflow geprueft werden.',
      disputedAmountCents: 25_000,
      currency: 'EUR',
      resolvedAt: null,
      resolution: null,
      resolutionText: null,
      refundAmountCents: null,
    },
    create: {
      id: 'dispute_1',
      jobId: 'preview_transport_001',
      createdById: shipper.id,
      againstId: carrier.id,
      status: 'OPEN',
      reason: 'Waren beschaedigt angekommen',
      subject: 'Beschaedigte Palettenware',
      description:
        'Mehrere Kartons waren bei Zustellung aufgerissen. Fotos und CMR sollen im Workflow geprueft werden.',
      disputedAmountCents: 25_000,
      currency: 'EUR',
    },
  });

  await prisma.disputeMessage.upsert({
    where: { id: 'preview_dispute_msg_1' },
    update: {
      message: 'Ich moechte eine Erstattung, da die Ware beschaedigt angekommen ist.',
    },
    create: {
      id: 'preview_dispute_msg_1',
      disputeId: 'dispute_1',
      senderId: shipper.id,
      senderType: 'SHIPPER',
      message: 'Ich moechte eine Erstattung, da die Ware beschaedigt angekommen ist.',
      createdAt: yesterday,
    },
  });

  await prisma.disputeMessage.upsert({
    where: { id: 'preview_dispute_msg_2' },
    update: {
      message: 'Die Ware wurde beim Laden kontrolliert. Bitte CMR/POD und Schadenfotos pruefen.',
    },
    create: {
      id: 'preview_dispute_msg_2',
      disputeId: 'dispute_1',
      senderId: carrier.id,
      senderType: 'TRANSPORTER',
      message: 'Die Ware wurde beim Laden kontrolliert. Bitte CMR/POD und Schadenfotos pruefen.',
      createdAt: now,
    },
  });

  await prisma.disputeAttachment.upsert({
    where: { id: 'preview_dispute_attachment_1' },
    update: {
      fileName: 'damage-photo-preview.jpg',
      fileUrl: '/preview/damage-photo-preview.jpg',
      fileType: 'image/jpeg',
    },
    create: {
      id: 'preview_dispute_attachment_1',
      disputeId: 'dispute_1',
      fileName: 'damage-photo-preview.jpg',
      fileUrl: '/preview/damage-photo-preview.jpg',
      fileType: 'image/jpeg',
      fileSize: 128_000,
      uploadedBy: shipper.id,
    },
  });

  await prisma.notification.create({
    data: {
      userId: shipper.id,
      type: 'DISPUTE_PREVIEW_READY',
      title: 'Streitfall Preview ist bereit',
      message: 'Der CargoBit Streitfall-Workflow kann lokal getestet werden.',
      data: JSON.stringify({ disputeId: 'dispute_1', jobId: 'preview_transport_001' }),
    },
  });

  console.log('Preview seed ready: dispute_1');
}

async function attachRole(userId, roleName) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) return;

  await prisma.userRoleRelation.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
}
