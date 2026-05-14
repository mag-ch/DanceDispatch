import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type GoogleCalendarWebhookLogLevel = 'info' | 'warn' | 'error';

export type GoogleCalendarWebhookLog = {
  id: string;
  createdAt: string;
  level: GoogleCalendarWebhookLogLevel;
  event: string;
  details?: Record<string, unknown>;
};

const MAX_LOG_ENTRIES = 500;
const LOG_FILE_PATH = path.join(process.cwd(), 'instance', 'google-calendar-webhook-logs.json');

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureLogDir(): Promise<void> {
  await mkdir(path.dirname(LOG_FILE_PATH), { recursive: true });
}

async function readLogsFromDisk(): Promise<GoogleCalendarWebhookLog[]> {
  try {
    const raw = await readFile(LOG_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is GoogleCalendarWebhookLog => {
      return !!entry && typeof entry === 'object' && 'id' in entry && 'createdAt' in entry && 'event' in entry;
    });
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeLogsToDisk(logs: GoogleCalendarWebhookLog[]): Promise<void> {
  await ensureLogDir();
  await writeFile(LOG_FILE_PATH, JSON.stringify(logs, null, 2), 'utf8');
}

export async function addGoogleCalendarWebhookLog(
  event: string,
  details?: Record<string, unknown>,
  level: GoogleCalendarWebhookLogLevel = 'info'
): Promise<GoogleCalendarWebhookLog> {
  const entry: GoogleCalendarWebhookLog = {
    id: createLogId(),
    createdAt: new Date().toISOString(),
    level,
    event,
    details,
  };

  const webhookLogs = await readLogsFromDisk();
  webhookLogs.push(entry);
  if (webhookLogs.length > MAX_LOG_ENTRIES) {
    webhookLogs.splice(0, webhookLogs.length - MAX_LOG_ENTRIES);
  }

  await writeLogsToDisk(webhookLogs);

  return entry;
}

export async function getGoogleCalendarWebhookLogs(): Promise<GoogleCalendarWebhookLog[]> {
  return readLogsFromDisk();
}
