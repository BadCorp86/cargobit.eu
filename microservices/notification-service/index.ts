// CargoBit Notification Service
// ================================
// Handles: Email, SMS, Push, Webhooks, Slack

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  Notification,
  NotificationChannel,
  ApiResponse
} from '../shared/types';
import {
  generateId,
  Logger,
  AppError,
  ValidationError,
  NotFoundError,
  successResponse,
  errorResponse,
  getEnv
} from '../shared/utils';

// ============================================
// CONFIGURATION
// ============================================

const logger = new Logger('notification-service');
const app = express();

// Channel configurations
const CHANNEL_CONFIG = {
  email: {
    enabled: true,
    provider: 'smtp', // or 'sendgrid', 'mailgun'
    retryLimit: 3
  },
  sms: {
    enabled: true,
    provider: 'twilio',
    retryLimit: 3
  },
  push: {
    enabled: true,
    provider: 'firebase',
    retryLimit: 5
  },
  webhook: {
    enabled: true,
    timeout: 5000,
    retryLimit: 3
  },
  slack: {
    enabled: true,
    webhookUrl: getEnv('SLACK_WEBHOOK_URL', ''),
    retryLimit: 3
  }
};

// Notification templates
const TEMPLATES: Record<string, { subject: string; channels: NotificationChannel[] }> = {
  'order.created': {
    subject: 'Neuer Auftrag erstellt - CargoBit',
    channels: ['email', 'push']
  },
  'order.assigned': {
    subject: 'Auftrag zugewiesen - CargoBit',
    channels: ['email', 'sms', 'push']
  },
  'order.in_transit': {
    subject: 'Transport gestartet - CargoBit',
    channels: ['email', 'push']
  },
  'order.completed': {
    subject: 'Transport abgeschlossen - CargoBit',
    channels: ['email', 'push']
  },
  'payment.received': {
    subject: 'Zahlung erhalten - CargoBit',
    channels: ['email', 'push']
  },
  'insurance.policy_created': {
    subject: 'Versicherungspolice erstellt - CargoBit',
    channels: ['email']
  },
  'risk.alert': {
    subject: 'Risiko-Warnung - CargoBit',
    channels: ['email', 'slack']
  }
};

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(express.json());

interface AuthRequest extends Request {
  userId?: string;
  partnerId?: string;
  serviceId?: string;
}

app.use((req: AuthRequest, res: Response, next: NextFunction) => {
  req.userId = req.headers['x-user-id'] as string;
  req.partnerId = req.headers['x-partner-id'] as string;
  req.serviceId = req.headers['x-service-id'] as string;
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${Date.now()}`;
  next();
});

// ============================================
// IN-MEMORY DATABASE
// ============================================

interface StoredNotification extends Notification {
  templateId?: string;
  retryLog: { timestamp: Date; error?: string }[];
}

const notifications: Map<string, StoredNotification> = new Map();
const userTokens: Map<string, { pushTokens: string[]; email: string; phone?: string }> = new Map();

// ============================================
// ROUTES: NOTIFICATIONS
// ============================================

// GET /notifications - List user notifications
app.get('/notifications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 20, status, channel } = req.query;

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
      });
    }

    let filtered = Array.from(notifications.values())
      .filter(n => n.userId === req.userId);

    if (status) {
      filtered = filtered.filter(n => n.status === status);
    }
    if (channel) {
      filtered = filtered.filter(n => n.channel === channel);
    }

    // Sort by date descending
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Paginate
    const total = filtered.length;
    const startIndex = (Number(page) - 1) * Number(pageSize);
    const paginated = filtered.slice(startIndex, startIndex + Number(pageSize));

    res.setHeader('X-Total-Count', total.toString());
    res.json(successResponse({
      data: paginated,
      total,
      page: Number(page),
      pageSize: Number(pageSize)
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// GET /notifications/:id - Get notification
app.get('/notifications/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = notifications.get(req.params.id);
    
    if (!notification) {
      throw new NotFoundError('Notification');
    }

    if (notification.userId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCESS_DENIED', message: 'Access denied' }
      });
    }

    res.json(successResponse(notification, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /notifications/:id/read - Mark as read
app.post('/notifications/:id/read', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = notifications.get(req.params.id);
    
    if (!notification) {
      throw new NotFoundError('Notification');
    }

    notification.status = 'delivered';
    notifications.set(notification.id, notification);

    res.json(successResponse(notification, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /notifications/read-all - Mark all as read
app.post('/notifications/read-all', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
      });
    }

    let updated = 0;
    Array.from(notifications.values())
      .filter(n => n.userId === req.userId && n.status !== 'delivered')
      .forEach(n => {
        n.status = 'delivered';
        notifications.set(n.id, n);
        updated++;
      });

    res.json(successResponse({ updated }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: SEND NOTIFICATIONS (Internal)
// ============================================

// POST /notifications/send - Send notification
app.post('/notifications/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      userId,
      partnerId,
      type,
      channel,
      subject,
      message,
      data,
      scheduledFor
    } = req.body;

    if (!type || !message) {
      throw new ValidationError('Missing required fields: type, message');
    }

    // Get template if exists
    const template = TEMPLATES[type];
    const channels = channel ? [channel] as NotificationChannel[] : template?.channels || ['email'];

    const createdNotifications: StoredNotification[] = [];

    for (const ch of channels) {
      const notificationId = generateId('notif');
      const notification: StoredNotification = {
        id: notificationId,
        userId,
        partnerId,
        type,
        channel: ch,
        subject: subject || template?.subject || type,
        message,
        data,
        status: scheduledFor ? 'pending' : 'pending',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        retryCount: 0,
        retryLog: [],
        createdAt: new Date()
      };

      notifications.set(notificationId, notification);
      createdNotifications.push(notification);

      // Send immediately if not scheduled
      if (!scheduledFor) {
        sendNotification(notification);
      }
    }

    logger.info('Notifications created', { 
      type, 
      channels, 
      userId,
      count: createdNotifications.length 
    });

    res.status(201).json(successResponse({
      created: createdNotifications.length,
      notifications: createdNotifications
    }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// POST /notifications/send-batch - Send batch notifications
app.post('/notifications/send-batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notifications: notificationBatch } = req.body;

    if (!Array.isArray(notificationBatch) || notificationBatch.length === 0) {
      throw new ValidationError('notifications array is required');
    }

    const results = {
      created: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const item of notificationBatch) {
      try {
        const { userId, type, channel, subject, message, data } = item;

        const notificationId = generateId('notif');
        const notification: StoredNotification = {
          id: notificationId,
          userId,
          type,
          channel: channel as NotificationChannel,
          subject,
          message,
          data,
          status: 'pending',
          retryCount: 0,
          retryLog: [],
          createdAt: new Date()
        };

        notifications.set(notificationId, notification);
        results.created++;

        // Send async
        sendNotification(notification);
      } catch (error) {
        results.failed++;
        results.errors.push((error as Error).message);
      }
    }

    res.status(201).json(successResponse(results, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: USER TOKENS
// ============================================

// POST /notifications/tokens/push - Register push token
app.post('/notifications/tokens/push', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token, platform } = req.body;

    if (!req.userId || !token) {
      throw new ValidationError('userId and token are required');
    }

    const userToken = userTokens.get(req.userId) || { pushTokens: [], email: '' };
    
    if (!userToken.pushTokens.includes(token)) {
      userToken.pushTokens.push(token);
      userTokens.set(req.userId, userToken);
    }

    logger.info('Push token registered', { userId: req.userId, platform });

    res.json(successResponse({ registered: true }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// DELETE /notifications/tokens/push - Unregister push token
app.delete('/notifications/tokens/push', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!req.userId || !token) {
      throw new ValidationError('userId and token are required');
    }

    const userToken = userTokens.get(req.userId);
    if (userToken) {
      userToken.pushTokens = userToken.pushTokens.filter(t => t !== token);
      userTokens.set(req.userId, userToken);
    }

    res.json(successResponse({ unregistered: true }, req.headers['x-request-id'] as string));
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROUTES: WEBHOOKS
// ============================================

// POST /notifications/webhook/test - Test webhook
app.post('/notifications/webhook/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, secret } = req.body;

    if (!url) {
      throw new ValidationError('url is required');
    }

    const payload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook' }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': secret || '',
          'X-Webhook-Event': 'webhook.test'
        },
        body: JSON.stringify(payload)
      });

      res.json(successResponse({
        success: response.ok,
        statusCode: response.status,
        payload
      }, req.headers['x-request-id'] as string));
    } catch (error) {
      res.json(successResponse({
        success: false,
        error: (error as Error).message
      }, req.headers['x-request-id'] as string));
    }
  } catch (error) {
    next(error);
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function sendNotification(notification: StoredNotification): Promise<void> {
  const channel = notification.channel;
  const config = CHANNEL_CONFIG[channel];

  if (!config.enabled) {
    notification.status = 'failed';
    notification.retryLog.push({ timestamp: new Date(), error: 'Channel disabled' });
    notifications.set(notification.id, notification);
    return;
  }

  try {
    switch (channel) {
      case 'email':
        await sendEmail(notification);
        break;
      case 'sms':
        await sendSMS(notification);
        break;
      case 'push':
        await sendPush(notification);
        break;
      case 'webhook':
        await sendWebhook(notification);
        break;
      case 'slack':
        await sendSlack(notification);
        break;
    }

    notification.status = 'sent';
    notification.sentAt = new Date();
    logger.info('Notification sent', { 
      notificationId: notification.id, 
      channel,
      type: notification.type 
    });
  } catch (error) {
    notification.retryCount++;
    notification.retryLog.push({ 
      timestamp: new Date(), 
      error: (error as Error).message 
    });

    if (notification.retryCount >= config.retryLimit) {
      notification.status = 'failed';
      logger.error('Notification failed after retries', error as Error, {
        notificationId: notification.id,
        channel
      });
    } else {
      // Schedule retry
      logger.warn('Notification retry scheduled', {
        notificationId: notification.id,
        channel,
        retryCount: notification.retryCount
      });
    }
  }

  notifications.set(notification.id, notification);
}

async function sendEmail(notification: StoredNotification): Promise<void> {
  // In production: use nodemailer, sendgrid, or mailgun
  logger.debug('Sending email', { 
    to: notification.userId,
    subject: notification.subject 
  });
  
  // Simulate email sending
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function sendSMS(notification: StoredNotification): Promise<void> {
  // In production: use Twilio
  logger.debug('Sending SMS', { 
    to: notification.userId,
    message: notification.message.substring(0, 50) 
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function sendPush(notification: StoredNotification): Promise<void> {
  // In production: use Firebase Cloud Messaging
  const userToken = userTokens.get(notification.userId || '');
  
  logger.debug('Sending push notification', { 
    userId: notification.userId,
    tokens: userToken?.pushTokens.length || 0
  });
  
  await new Promise(resolve => setTimeout(resolve, 50));
}

async function sendWebhook(notification: StoredNotification): Promise<void> {
  // In production: get webhook URL from partner/user config
  logger.debug('Sending webhook', { 
    type: notification.type 
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function sendSlack(notification: StoredNotification): Promise<void> {
  const webhookUrl = CHANNEL_CONFIG.slack.webhookUrl;
  
  if (!webhookUrl) {
    throw new Error('Slack webhook URL not configured');
  }

  const payload = {
    text: notification.subject,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${notification.subject}*\n${notification.message}`
        }
      }
    ]
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'notification-service',
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime(),
    stats: {
      notifications: notifications.size,
      usersWithTokens: userTokens.size
    },
    channels: Object.fromEntries(
      Object.entries(CHANNEL_CONFIG).map(([k, v]) => [k, v.enabled])
    ),
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err, { requestId: req.headers['x-request-id'] });
  
  const error = err instanceof AppError ? err : new AppError(err.message);
  
  res.status(error.statusCode).json(errorResponse(error, req.headers['x-request-id'] as string));
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3007;

app.listen(PORT, () => {
  logger.info(`Notification service started on port ${PORT}`);
  logger.info('Channels enabled:', Object.entries(CHANNEL_CONFIG)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k)
    .join(', ')
  );
});

export default app;
