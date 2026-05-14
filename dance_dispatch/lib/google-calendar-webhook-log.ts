import 'server-only';

export type GoogleCalendarWebhookLogLevel = 'info' | 'warn' | 'error';

export type GoogleCalendarWebhookLog = {
  id: string;
  createdAt: string;
  level: GoogleCalendarWebhookLogLevel;
  event: string;
  details?: Record<string, unknown>;
};

const MAX_LOG_ENTRIES = 500;
const webhookLogs: GoogleCalendarWebhookLog[] = [];

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addGoogleCalendarWebhookLog(
  event: string,
  details?: Record<string, unknown>,
  level: GoogleCalendarWebhookLogLevel = 'info'
): GoogleCalendarWebhookLog {
  const entry: GoogleCalendarWebhookLog = {
    id: createLogId(),
    createdAt: new Date().toISOString(),
    level,
    event,
    details,
  };

  webhookLogs.push(entry);
  if (webhookLogs.length > MAX_LOG_ENTRIES) {
    webhookLogs.splice(0, webhookLogs.length - MAX_LOG_ENTRIES);
  }

  return entry;
}

export function getGoogleCalendarWebhookLogs(): GoogleCalendarWebhookLog[] {
  return [...webhookLogs];
}
