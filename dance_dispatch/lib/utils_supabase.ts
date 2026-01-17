import { createClient } from "./supabase/server";

const supabase = createClient();


export async function getUsernameFromId(userId: string | number) {
  try {
    // Query the public profiles table for the username
    const { data, error } = await supabase
      .from('profiles') // Replace 'profiles' with your actual table name
      .select('username') // Select the column containing the username
      .eq('id', userId)   // Filter by the user ID
      .single<{ username: string }>();         // Expect a single result

    if (error) {
      console.error('Error fetching username:', error.message);
      return null;
    }

    if (data) {
      return data.username;
    } else {
      console.log('User profile not found for ID:', userId);
      return null;
    }
  } catch (error: unknown) {
    console.error('An unexpected error occurred:', error instanceof Error ? error.message : String(error));
    return null;
  }
}