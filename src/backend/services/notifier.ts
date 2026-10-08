import { prisma } from '../../lib/db';

export type ActivityType = 'USER_LOGIN' | 'USER_REGISTER' | 'GOOGLE_LOGIN' | 'ADMIN_LOGIN';
export const ActivityType = {
  USER_LOGIN: 'USER_LOGIN' as ActivityType,
  USER_REGISTER: 'USER_REGISTER' as ActivityType,
  GOOGLE_LOGIN: 'GOOGLE_LOGIN' as ActivityType,
  ADMIN_LOGIN: 'ADMIN_LOGIN' as ActivityType,
};

interface ActivityPayload {
  type: ActivityType;
  message: string;
  userId?: string;
  userEmail?: string;
  metadata?: Record<string, any>;
}

/**
 * Sends a push notification to Telegram if credentials are provided in .env
 */
async function sendTelegramNotification(text: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    // Silently skip if Telegram is not yet configured
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.warn('[TELEGRAM NOTIFIER WARN]: Telegram API responded with error:', errorData);
    }
  } catch (err: any) {
    console.error('[TELEGRAM NOTIFIER ERROR]: Failed to dispatch alert:', err.message);
  }
}

/**
 * Centrally records an activity in the database for analytics
 * and sends an instant Telegram notification to the administrator.
 */
export async function recordActivity(payload: ActivityPayload): Promise<void> {
  const { type, message, userId, userEmail, metadata } = payload;

  // 1. Record in Database for Analytics
  try {
    await prisma.activityLog.create({
      data: {
        type,
        message,
        userId: userId || null,
        metadata: metadata || {},
      },
    });
  } catch (err: any) {
    console.error('[ACTIVITY LOGGING ERROR]: Could not save activity to DB:', err.message);
  }

  // 2. Format and Send Telegram Push Notification
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' }) + ' UTC';

  let emoji = '🔔';
  if (type === ActivityType.USER_LOGIN) emoji = '🔑';
  if (type === ActivityType.USER_REGISTER) emoji = '🎉';
  if (type === ActivityType.GOOGLE_LOGIN) emoji = '🌐';
  if (type === ActivityType.ADMIN_LOGIN) emoji = '🛡️';

  const telegramMessage = `${emoji} *NCCDB Activity Alert*\n\n` +
    `*Event:* \`${type}\`\n` +
    `*Email:* \`${userEmail || 'N/A'}\`\n` +
    `*Details:* ${message}\n` +
    `*Timestamp:* ${timestamp}`;

  // Non-blocking fire-and-forget
  sendTelegramNotification(telegramMessage).catch(() => {});
}
