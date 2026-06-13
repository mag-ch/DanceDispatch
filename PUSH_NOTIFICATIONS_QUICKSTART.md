# Quick Start: Push Notifications Setup

## 1️⃣ Generate VAPID Keys (Required)
```bash
cd dance_dispatch
npx web-push generate-vapid-keys
```

Copy the output keys.

## 2️⃣ Update Environment (.env.local)
```env
# Web Push Configuration
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<paste-your-public-key>
VAPID_PRIVATE_KEY=<paste-your-private-key>
VAPID_SUBJECT=mailto:your-email@example.com
PUSH_SEND_SECRET=<strong-random-secret-for-server-jobs>
```

## 3️⃣ Create Supabase Table
Go to Supabase Dashboard → SQL Editor → paste this:

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage subscriptions"
  ON push_subscriptions FOR ALL
  USING (true) WITH CHECK (true);
```

## 4️⃣ Install & Run
```bash
npm install
npm run dev
```

## 5️⃣ Test
- Open app in browser
- After login, notification prompt should appear
- Enable notifications
- Check DevTools → Application → Service Workers
- Check Supabase: push_subscriptions table should have entries

## 📨 Send Test Notification
```bash
curl -X POST http://localhost:3000/api/push-notifications/send \
  -H "Content-Type: application/json" \
  -H "x-push-job-secret: YOUR_PUSH_SEND_SECRET" \
  -d '{
    "notification": {
      "title": "Test",
      "body": "Test notification",
      "icon": "/icons/icon-192.svg",
      "url": "/"
    }
  }'
```

## Components & Hooks Available

### Components
- `<PushNotificationPrompt />` - Automatic prompt (auto-imported in layout)
- `<NotificationSettings />` - Add to settings page

### Hooks
```typescript
const { 
  isSupported, 
  isSubscribed, 
  permission, 
  isLoading, 
  error, 
  subscribe, 
  unsubscribe, 
  requestPermission 
} = usePushNotifications();
```

## Sending Notifications Programmatically

### From Server Action/API Route:
```typescript
const response = await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-push-job-secret': process.env.PUSH_SEND_SECRET!,
  },
  body: JSON.stringify({
    userId: 'optional-user-id-or-all-users',
    notification: {
      title: 'Event Alert',
      body: 'New dance event nearby!',
      icon: '/icons/icon-192.svg',
      url: '/events/123'
    }
  })
});
```

## See Also
- Full guide: `PUSH_NOTIFICATIONS_SETUP.md`
- Utilities: `lib/push-notifications.ts`
- Hook: `app/hooks/usePushNotifications.ts`
