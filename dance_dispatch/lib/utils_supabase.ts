import { supabase } from "./supabase/client";

export async function getUsernameFromId(userId: string | number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single<{ username: string }>();

    if (error) {
      console.error('Error fetching username:', error.message);
      return null;
    }

    return data?.username ?? null;
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
