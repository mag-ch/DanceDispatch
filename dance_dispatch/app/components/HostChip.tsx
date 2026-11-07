import type { HostType } from '@/lib/host-types';

const HOST_TYPE_CHIP_CLASSES: Record<HostType, string> = {
  DJ: 'bg-fuchsia-600 text-white',
  Promoter: 'bg-amber-500 text-black',
  Organizer: 'bg-emerald-600 text-text',
  Teacher: 'bg-sky-600 text-white',
  Host: 'bg-accent text-text',
  Judge: 'bg-violet-600 text-white',
};

export function hostChipClass(type?: HostType | null): string {
  return HOST_TYPE_CHIP_CLASSES[type ?? 'Host'];
}

export function hostTypeLabel(type?: HostType | null): string {
  return type ?? 'Host';
}
