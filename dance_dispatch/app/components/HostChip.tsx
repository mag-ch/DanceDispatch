import type { HostType } from '@/lib/host-types';

const HOST_TYPE_CHIP_CLASSES: Record<HostType, string> = {
  DJ: 'bg-accent text-text',
  Promoter: 'bg-amber-500 text-text',
  Organizer: 'bg-emerald-600 text-text',
  Teacher: 'bg-sky-600 text-text',
  Host: 'bg-fuchsia-600 text-text',
  Judge: 'bg-violet-600 text-text',
};

export function hostChipClass(type?: HostType | null): string {
  return HOST_TYPE_CHIP_CLASSES[type ?? 'Host'];
}

export function hostTypeLabel(type?: HostType | null): string {
  return type ?? 'Host';
}
