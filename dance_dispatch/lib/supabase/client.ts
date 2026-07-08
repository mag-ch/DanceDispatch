// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

let browserClient: BrowserSupabaseClient | null = null;

function getRequiredEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'): string {
    const value =
        name === 'NEXT_PUBLIC_SUPABASE_URL'
            ? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
            : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }

    return value;
}

function getBrowserClient(): BrowserSupabaseClient {
    if (browserClient) {
        return browserClient;
    }

    browserClient = createBrowserClient(
        getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
        getRequiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    );

    return browserClient;
}

export const supabase = new Proxy({} as BrowserSupabaseClient, {
    get(_target, prop, receiver) {
        return Reflect.get(getBrowserClient(), prop, receiver);
    },
});

export const createClient = () => {
    return getBrowserClient();
};

export const APPROVED_USER_IDS = [
    'ba398812-06a0-4c48-9f15-0660d3af0047',
    'f2694e1c-5457-45b0-b299-c3a03a77d8c5',
    'e8191ca7-7856-4e81-9140-b93a944ec711'
];




export const canEditDetails = (userId?: string | null) => Boolean(userId && APPROVED_USER_IDS.includes(userId));



export function normalizeEventIds(rawValues: unknown): number[] {
  const values = Array.isArray(rawValues) ? rawValues : [];
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

export function normalizePlanId(rawValue: unknown): number | null {
  const value = Number(rawValue);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function formatPlanDefaultDate(startdate?: string | null, starttime?: string | null): string {
  const date = String(startdate ?? '').trim();
  if (!date) {
    return 'Party Plan';
  }

  const time = String(starttime ?? '').trim() || '00:00:00';
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) {
    return 'Party Plan';
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function defaultPlanNameFromEvents(events: Array<{ startdate?: string | null; starttime?: string | null }>): string {
  if (events.length === 0) {
    return 'Party Plan';
  }

  return `Party Plan - ${formatPlanDefaultDate(events[0].startdate, events[0].starttime)}`;
}
