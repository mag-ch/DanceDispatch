import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import webpush from "web-push";
import { timingSafeEqual } from "node:crypto";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@dancedispatch.com";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, any>;
}

function hasValidServerSecret(request: Request): boolean {
  const expected = process.env.PUSH_SEND_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const headerValue =
    request.headers.get("x-push-job-secret") ??
    (request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");

  if (!headerValue) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(headerValue);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  try {
    if (!process.env.PUSH_SEND_SECRET?.trim()) {
      return NextResponse.json(
        { error: "Push sender is not configured" },
        { status: 500 }
      );
    }

    if (!hasValidServerSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const payload = (await request.json()) as {
      userId?: string;
      notification: PushNotificationPayload;
    };

    const { userId, notification } = payload;

    if (!notification || !notification.title) {
      return NextResponse.json(
        { error: "Invalid notification payload" },
        { status: 400 }
      );
    }

    // Get subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    
    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch subscriptions" },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { success: true, sent: 0, message: "No subscriptions found" },
        { status: 200 }
      );
    }

    // Send notifications
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          },
          JSON.stringify(notification)
        )
      )
    );

    // Track failures
    const failures = results
      .map((result, index) => {
        if (result.status === "rejected") {
          const error = result.reason;
          // Clean up invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            void supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", subscriptions[index].endpoint);
          }
          return subscriptions[index].endpoint;
        }
        return null;
      })
      .filter(Boolean);

    return NextResponse.json(
      {
        success: true,
        sent: subscriptions.length - failures.length,
        failed: failures.length,
        message: `Sent ${subscriptions.length - failures.length} notifications`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
