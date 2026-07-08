export type PartyPlanEvent = {
  id: string | number;
  title: string;
  startdate?: string | null;
  starttime?: string | null;
  location?: string | null;
  price?: number | string | null;
};

export type PartyPlanSummary = {
  partyCount: number;
  dateRangeLabel: string;
  totalPrice: number;
  locationFlow: string;
};

function parseLocalDateTime(startdate?: string | null, starttime?: string | null): Date | null {
  const date = String(startdate ?? '').trim();
  if (!date) return null;

  const time = String(starttime ?? '').trim() || '00:00:00';
  const candidate = new Date(`${date}T${time}`);
  if (!Number.isNaN(candidate.getTime())) {
    return candidate;
  }

  const parsedDateOnly = new Date(date);
  return Number.isNaN(parsedDateOnly.getTime()) ? null : parsedDateOnly;
}

export function normalizePlanPrice(rawPrice: number | string | null | undefined): number {
  if (typeof rawPrice === 'number') {
    return Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
  }

  const parsed = Number(String(rawPrice ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatRangeStart(value: Date): string {
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatRangeEnd(value: Date): string {
  return value.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function buildPartyPlanSummary(events: PartyPlanEvent[]): PartyPlanSummary {
  const sorted = [...events].sort((a, b) => {
    const aTime = parseLocalDateTime(a.startdate, a.starttime)?.getTime() ?? 0;
    const bTime = parseLocalDateTime(b.startdate, b.starttime)?.getTime() ?? 0;
    return aTime - bTime;
  });

  const validDates = sorted
    .map((event) => parseLocalDateTime(event.startdate, event.starttime))
    .filter((value): value is Date => Boolean(value));

  let dateRangeLabel = 'Dates TBD';
  if (validDates.length === 1) {
    dateRangeLabel = formatRangeEnd(validDates[0]);
  } else if (validDates.length > 1) {
    dateRangeLabel = `${formatRangeStart(validDates[0])} - ${formatRangeEnd(validDates[validDates.length - 1])}`;
  }

  const totalPrice = sorted.reduce((sum, event) => sum + normalizePlanPrice(event.price), 0);

  const locationFlowParts = sorted
    .map((event) => String(event.location ?? '').trim())
    .filter(Boolean)
    .reduce<string[]>((acc, location) => {
      if (acc[acc.length - 1] !== location) {
        acc.push(location);
      }
      return acc;
    }, []);

  const locationFlow = locationFlowParts.length > 0 ? locationFlowParts.join(' -> ') : 'Locations TBD';

  return {
    partyCount: sorted.length,
    dateRangeLabel,
    totalPrice,
    locationFlow,
  };
}

export function parseEventIdsParam(input?: string | null): number[] {
  if (!input) return [];

  const values = input
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(values)];
}

export function serializeEventIdsParam(eventIds: Array<number | string>): string {
  const normalized = eventIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(normalized)].join(',');
}
