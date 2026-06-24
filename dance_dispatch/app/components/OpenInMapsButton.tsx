// app/components/OpenInMapsButton.tsx
'use client';

import { MapPin } from 'lucide-react';
import { openInMaps } from '@/lib/utils_supabase';

export default function OpenInMapsButton({ address }: { address: string }) {
  return (
    <button
      type="button"
      onClick={() => openInMaps(address)}
      className="flex items-start gap-4 mb-2 hover:text-blue-500 transition-colors text-left w-full"
    >
      <MapPin className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
      <div>
        <h2 className="font-semibold text-text text-lg">Address</h2>
        <p className="text-text hover:underline">{address}</p>
      </div>
    </button>
  );
}