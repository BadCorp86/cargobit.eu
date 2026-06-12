import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOptionalRequestUser } from '@/lib/request-user-auth';

const FEEDBACK_CATEGORIES = new Set([
  'Funktion fehlt',
  'Bedienbarkeit',
  'Preis & Zahlungsschutz',
  'Transportprozess',
  'Verifizierung',
  'Sonstiges',
]);

function cleanText(value: unknown, maxLength: number) {
  return String(value || '').trim().slice(0, maxLength);
}

async function resolveFeedbackUser(request: NextRequest) {
  const requestUser = await getOptionalRequestUser(request);
  if (!requestUser) return null;
  return db.user.findUnique({ where: { id: requestUser.id } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await resolveFeedbackUser(request);

    if (!user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Bitte anmelden, damit wir Rückfragen stellen können.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 },
      );
    }

    const category = FEEDBACK_CATEGORIES.has(body.category) ? body.category : 'Sonstiges';
    const message = cleanText(body.message, 4000);
    const roleContext = cleanText(body.roleContext, 160);
    const pageUrl = cleanText(body.pageUrl, 500);

    if (message.length < 10) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Bitte beschreibe deinen Vorschlag mit mindestens 10 Zeichen.',
          code: 'MESSAGE_TOO_SHORT',
        },
        { status: 400 },
      );
    }

    const description = [
      message,
      '',
      '--- Kontext ---',
      `Kategorie: ${category}`,
      roleContext ? `Rolle/Kontext: ${roleContext}` : null,
      pageUrl ? `Seite: ${pageUrl}` : null,
    ].filter(Boolean).join('\n');

    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        subject: `Produkt-Feedback: ${category}`,
        description,
        priority: 'LOW',
        status: 'OPEN',
        category: 'PRODUCT_FEEDBACK',
        messages: {
          create: {
            senderId: user.id,
            senderRole: 'USER',
            message: description,
            isInternal: false,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        status: ticket.status,
        category: ticket.category,
      },
    });
  } catch (error) {
    console.error('[Feedback] Create feedback ticket failed:', error);
    return NextResponse.json(
      {
        error: 'InternalServerError',
        message: 'Feedback konnte nicht gespeichert werden.',
        code: 'FEEDBACK_CREATE_FAILED',
      },
      { status: 500 },
    );
  }
}
