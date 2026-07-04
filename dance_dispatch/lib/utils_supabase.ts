import { supabase } from "./supabase/client";

export async function getUsernameFromId(userId: string | number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();


    if (error) {
      console.error('Error fetching username:', error.message);
      return null;
    }

    const row = data as { username?: string } | null;
    return row?.username ?? null;
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error instanceof Error ? error.message : String(error));
    return null;
  }
}


export function openInMaps(address: string) {
    const encoded = encodeURIComponent(address);
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    if (/iPhone|iPad|iPod|Mac/i.test(ua)) {
        window.open(`maps://maps.apple.com/?q=${encoded}`, '_blank');
    } else if (/Android/i.test(ua)) {
        window.open(`geo:0,0?q=${encoded}`, '_blank');
    } else {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
    }
}

