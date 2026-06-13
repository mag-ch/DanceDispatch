import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-helpers";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    // Get current subscription endpoint from request body or client
    const { endpoint } = (await request.json()) as { endpoint?: string };

    if (endpoint) {
      // Delete specific subscription by endpoint
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_id", user.id);

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to delete subscription" },
          { status: 500 }
        );
      }
    } else {
      // Delete all subscriptions for user
      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user.id);

      if (error) {
        console.error("Database error:", error);
        return NextResponse.json(
          { error: "Failed to delete subscriptions" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: true, message: "Subscription removed" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unsubscription error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
