type SendGridAddress = {
  email: string;
  name?: string;
};

type SendGridInput = {
  to: string | SendGridAddress | SendGridAddress[];
  subject: string;
  html: string;
  text?: string;
};

export type SendGridResult = {
  success: boolean;
  provider: 'sendgrid' | 'dev-log';
  messageId?: string;
  error?: string;
};

export async function sendTransactionalEmail(input: SendGridInput): Promise<SendGridResult> {
  const recipients = normalizeRecipients(input.to);

  if (!process.env.SENDGRID_API_KEY) {
    console.log('[TransactionalEmail] DEV email would be sent:', {
      to: recipients.map((recipient) => recipient.email),
      subject: input.subject,
    });

    return {
      success: true,
      provider: 'dev-log',
      messageId: `dev-email-${Date.now()}`,
    };
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: recipients }],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@cargobit.eu',
        name: process.env.SENDGRID_FROM_NAME || 'CargoBit',
      },
      subject: input.subject,
      content: [
        ...(input.text ? [{ type: 'text/plain', value: input.text }] : []),
        { type: 'text/html', value: input.html },
      ],
    }),
  });

  return {
    success: response.ok,
    provider: 'sendgrid',
    messageId: response.headers.get('x-message-id') || undefined,
    error: response.ok ? undefined : await response.text(),
  };
}

function normalizeRecipients(to: SendGridInput['to']): SendGridAddress[] {
  const list = Array.isArray(to) ? to : [to];

  return list.map((recipient) => {
    if (typeof recipient === 'string') {
      return { email: recipient };
    }

    return recipient;
  });
}
