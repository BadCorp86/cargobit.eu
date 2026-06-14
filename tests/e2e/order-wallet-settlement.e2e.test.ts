import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const shipperToken = process.env.E2E_SHIPPER_TOKEN || '';
const carrierToken = process.env.E2E_CARRIER_TOKEN || '';
const settlementReadyJobId = process.env.E2E_SETTLEMENT_READY_JOB_ID || 'e2e_settlement_ready_transport';
const carrierPayoutMethodId = process.env.E2E_CARRIER_PAYOUT_METHOD_ID || 'e2e_carrier_payout_method';
const cronSecret = process.env.E2E_CRON_SECRET || process.env.CRON_SECRET || readLocalEnvValue('CRON_SECRET') || '';

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

function readLocalEnvValue(key: string) {
  const filePath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) return null;

  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

test.describe('CargoBit Auftrag bis Auszahlung E2E', () => {
  test.skip(process.env.RUN_ORDER_E2E !== 'true', 'Set RUN_ORDER_E2E=true and seed deterministic users/wallets first.');
  test.skip(!shipperToken || !carrierToken, 'Run npm run db:seed:e2e and export E2E_SHIPPER_TOKEN/E2E_CARRIER_TOKEN first.');

  test('creates, reserves, publishes, bids, accepts and completes an order with session auth', async ({ request }) => {
    const wallet = await request.get(`${BASE_URL}/api/wallet`, {
      headers: authHeaders(shipperToken),
    });
    expect(wallet.status()).toBe(200);

    const createJob = await request.post(`${BASE_URL}/api/jobs`, {
      headers: authHeaders(shipperToken),
      data: {
        pickupAddress: {
          street: 'Teststraße 1',
          postalCode: '10115',
          city: 'Berlin',
          country: 'DE',
        },
        deliveryAddress: {
          street: 'Testweg 2',
          postalCode: '80331',
          city: 'München',
          country: 'DE',
        },
        pickupDatetime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        deliveryDatetime: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        transportType: 'PALLET',
        weightKg: 500,
        volumeM3: 2,
        shipperBudget: 850,
        description: 'E2E Testauftrag',
        cargoDetails: { pallets: 2, test: true },
      },
    });
    expect(createJob.status()).toBeLessThan(500);
    const created = await createJob.json();
    expect(created.jobId || created.job?.id).toBeTruthy();
    const jobId = created.jobId || created.job.id;

    const publish = await request.post(`${BASE_URL}/api/jobs/${jobId}/publish`, {
      headers: authHeaders(shipperToken),
    });
    expect([200, 402, 409]).toContain(publish.status());

    if (publish.status() === 402) {
      const topup = await request.post(`${BASE_URL}/api/wallet`, {
        headers: authHeaders(shipperToken),
        data: { amountCents: 120000, simulateCredit: true, returnTo: `/orders/${jobId}` },
      });
      expect(topup.status()).toBe(200);

      const retryPublish = await request.post(`${BASE_URL}/api/jobs/${jobId}/publish`, {
        headers: authHeaders(shipperToken),
      });
      expect(retryPublish.status()).toBe(200);
    }

    const bid = await request.post(`${BASE_URL}/api/jobs/${jobId}/bids`, {
      headers: authHeaders(carrierToken),
      data: {
        price: 820,
        message: 'E2E Angebot',
        validUntilHours: 24,
      },
    });
    expect([200, 201]).toContain(bid.status());
    const bidBody = await bid.json();
    const bidId = bidBody.bidId || bidBody.id;
    expect(bidId).toBeTruthy();

    const accept = await request.patch(`${BASE_URL}/api/jobs/${jobId}/accept_bid`, {
      headers: authHeaders(shipperToken),
      data: { bid_id: bidId },
    });
    expect(accept.status()).toBe(200);

    const inTransit = await request.post(`${BASE_URL}/api/jobs/${jobId}/status`, {
      headers: authHeaders(carrierToken),
      data: {
        status: 'IN_TRANSIT',
        description: 'E2E Abholung bestätigt',
      },
    });
    expect(inTransit.status()).toBe(200);

    const complete = await request.post(`${BASE_URL}/api/jobs/${jobId}/complete`, {
      headers: authHeaders(carrierToken),
      data: {
        delivery_photo_url: 'https://example.test/pod.jpg',
        pod_signature_url: 'https://example.test/pod-signature.png',
        notes: 'E2E Lieferung abgeschlossen',
      },
    });
    expect(complete.status()).toBe(200);

    const readiness = await request.get(`${BASE_URL}/api/orders/${jobId}/payout/release?amount=820`, {
      headers: authHeaders(carrierToken),
    });
    expect([200, 409]).toContain(readiness.status());
  });

  test('releases a due settlement via cron and allows carrier wallet payout only from own wallet', async ({ request }) => {
    const before = await request.get(`${BASE_URL}/api/wallet`, {
      headers: authHeaders(carrierToken),
    });
    expect(before.status()).toBe(200);

    const readiness = await request.get(`${BASE_URL}/api/orders/${settlementReadyJobId}/payout/release?amount=820`, {
      headers: authHeaders(carrierToken),
    });
    expect(readiness.status()).toBe(200);

    const cronHeaders = cronSecret ? { 'x-cron-secret': cronSecret } : {};
    const cron = await request.post(`${BASE_URL}/api/cron/payouts/run`, {
      headers: cronHeaders,
    });
    expect(cron.status()).toBe(200);

    const afterRelease = await request.get(`${BASE_URL}/api/wallet`, {
      headers: authHeaders(carrierToken),
    });
    expect(afterRelease.status()).toBe(200);
    const afterReleaseBody = await afterRelease.json();
    const available = afterReleaseBody.wallet?.availableBalance;
    expect(typeof available).toBe('number');
    expect(available).toBeGreaterThanOrEqual(820);

    const payoutIdempotencyKey = `e2e-carrier-payout-${Date.now()}`;
    const payoutRequest = {
      amount: 100,
      currency: 'EUR',
      payoutMethodId: carrierPayoutMethodId,
      description: 'E2E Bankauszahlung aus Transporteur-Wallet',
      idempotencyKey: payoutIdempotencyKey,
    };
    const payout = await request.post(`${BASE_URL}/api/wallet/payout`, {
      headers: authHeaders(carrierToken),
      data: payoutRequest,
    });
    expect(payout.status()).toBe(200);

    const duplicatePayout = await request.post(`${BASE_URL}/api/wallet/payout`, {
      headers: authHeaders(carrierToken),
      data: payoutRequest,
    });
    expect(duplicatePayout.status()).toBe(200);
    const duplicatePayoutBody = await duplicatePayout.json();
    expect(duplicatePayoutBody.duplicate).toBe(true);

    const shipperPayoutAttempt = await request.post(`${BASE_URL}/api/wallet/payout`, {
      headers: authHeaders(shipperToken),
      data: {
        amount: 100,
        currency: 'EUR',
        payoutMethodId: carrierPayoutMethodId,
        description: 'E2E Fremd-Wallet-Auszahlung muss blockiert werden',
        idempotencyKey: `e2e-shipper-payout-blocked-${Date.now()}`,
      },
    });
    expect([403, 404]).toContain(shipperPayoutAttempt.status());
  });
});
