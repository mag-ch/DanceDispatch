import type { HostType } from '@/lib/host-types';

// null type is a plain "host".
const HOST_TYPE_CHIP_CLASSES: Record<HostType | 'host', string> = {
  DJ: 'bg-fuchsia-600 text-white',
  promoter: 'bg-amber-500 text-black',
  organizer: 'bg-emerald-600 text-white',
  teacher: 'bg-sky-600 text-white',
  host: 'bg-accent text-text',
};

export function hostChipClass(type?: HostType | null): string {
  return HOST_TYPE_CHIP_CLASSES[type ?? 'host'];
}

export function hostTypeLabel(type?: HostType | null): string {
  return type ?? 'Host';
}

// Builds an id -> type map from parallel hostIDs/hostTypes arrays.
export function hostTypeMapFrom(
  hostIds?: string[],
  hostTypes?: (HostType | null)[]
): Record<string, HostType | null> {
  const map: Record<string, HostType | null> = {};
  (hostIds ?? []).forEach((id, index) => {
    map[String(id)] = hostTypes?.[index] ?? null;
  });
  return map;
}
