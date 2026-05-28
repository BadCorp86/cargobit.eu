import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  buildLifecycleFromTransport,
  lifecycleBlueprint,
  type LifecycleStage,
} from '@/lib/product-operating-model';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId') || searchParams.get('transportId');

  if (!orderId) {
    return NextResponse.json({
      lifecycle: lifecycleBlueprint,
      source: 'blueprint',
      nextAction: lifecycleBlueprint.find((stage) => stage.status === 'active') || lifecycleBlueprint[0],
    });
  }

  try {
    const transport = await prisma.transport.findUnique({
      where: { id: orderId },
      include: {
        offers: true,
        assignment: true,
        documents: true,
        commissions: true,
        statusHistory: {
          orderBy: { changedAt: 'asc' },
        },
      },
    });

    if (!transport) {
      if (isDemoOrderId(orderId)) {
        const lifecycle = buildLifecycleFromTransport('DELIVERY_DONE');

        return NextResponse.json({
          orderId,
          status: 'DELIVERY_DONE',
          lifecycle,
          source: 'fallback',
          warning: 'Demo order lifecycle fallback',
          nextAction: lifecycle.find((stage) => stage.status === 'active' || stage.status === 'next') || lifecycle[0],
          commercial: {
            budget: 850,
            agreedPrice: 850,
            currency: 'EUR',
            commissionRecorded: true,
            documents: [
              { id: 'demo-cmr', type: 'cmr', name: 'CMR/Frachtbrief', url: '/uploads/demo-cmr.pdf' },
            ],
          },
          timeline: [],
        });
      }

      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Transport not found' },
        { status: 404 },
      );
    }

    const lifecycle = enrichLifecycle(buildLifecycleFromTransport(transport.status), transport);

    return NextResponse.json({
      orderId,
      status: transport.status,
      lifecycle,
      nextAction: lifecycle.find((stage) => stage.status === 'active' || stage.status === 'next') || lifecycle[0],
      commercial: {
        budget: transport.shipperBudget,
        agreedPrice: transport.agreedPrice,
        currency: transport.currency,
        commissionRecorded: transport.commissions.length > 0,
        documents: transport.documents.map((document: any) => ({
          id: document.id,
          type: document.type,
          name: document.name,
          url: document.fileUrl,
        })),
      },
      timeline: transport.statusHistory,
      source: 'database',
    });
  } catch (error) {
    console.error('[OrderLifecycleAPI] Failed:', error);
    const demo = orderId ? isDemoOrderId(orderId) : false;
    const lifecycle = buildLifecycleFromTransport(demo ? 'DELIVERY_DONE' : 'PUBLISHED');

    return NextResponse.json({
      orderId,
      status: demo ? 'DELIVERY_DONE' : 'PUBLISHED',
      lifecycle,
      source: 'fallback',
      warning: 'Database unavailable, using product lifecycle fallback',
      nextAction: lifecycle.find((stage) => stage.status === 'active') || lifecycle[0],
      commercial: demo
        ? {
            budget: 850,
            agreedPrice: 850,
            currency: 'EUR',
            commissionRecorded: true,
            documents: [
              { id: 'demo-cmr', type: 'cmr', name: 'CMR/Frachtbrief', url: '/uploads/demo-cmr.pdf' },
            ],
          }
        : undefined,
      timeline: [],
    });
  }
}

function isDemoOrderId(orderId: string) {
  return orderId.startsWith('mission_demo') || orderId.startsWith('demo') || orderId.startsWith('TR-');
}

function enrichLifecycle(lifecycle: LifecycleStage[], transport: any): LifecycleStage[] {
  return lifecycle.map((stage) => {
    if (stage.id === 'offer' && transport.offers?.length) {
      const accepted = transport.offers.find((offer: any) => offer.status === 'ACCEPTED');
      return {
        ...stage,
        description: accepted
          ? `Angebot angenommen: ${accepted.price.toFixed(2)} ${accepted.currency}`
          : `${transport.offers.length} Angebot(e) liegen vor.`,
      };
    }

    if (stage.id === 'pod') {
      const pod = transport.documents?.find((document: any) => ['pod', 'foto_delivery'].includes(document.type));
      return {
        ...stage,
        status: pod ? 'done' : stage.status,
        description: pod ? `Abliefernachweis vorhanden: ${pod.name}` : stage.description,
      };
    }

    if (stage.id === 'invoice' && transport.commissions?.length) {
      return {
        ...stage,
        description: 'Gebuehren und Wallet-Abrechnung wurden fuer die Rechnung vorbereitet.',
      };
    }

    return stage;
  });
}
