# Push Notifications Implementation Guide

## Overview
Your DanceDispatch PWA now includes full push notification support with the following features:
- Service worker-based push handling
- Client-side subscription management
- Server-side VAPID authentication
- Automatic subscription cleanup
- User preference management

## Files Created

### Core Utilities
- **`lib/push-notifications.ts`** - Low-level Web Push API utilities
- **`app/hooks/usePushNotifications.ts`** - React hook for managing subscriptions

### Components
- **`app/components/PushNotificationPrompt.tsx`** - User-facing prompt to enable notifications
- **`app/components/NotificationSettings.tsx`** - Settings UI for managing notifications

### API Routes
- **`app/api/push-notifications/subscribe/route.ts`** - Subscribe endpoint
- **`app/api/push-notifications/unsubscribe/route.ts`** - Unsubscribe endpoint
- **`app/api/push-notifications/send/route.ts`** - Send notifications endpoint

### Frontend Updates
- **`public/sw.js`** - Enhanced service worker with push event handlers
- **`app/manifest.ts`** - Updated web app manifest
- **`app/components/PWARegister.tsx`** - Improved SW registration with update checking
- **`app/layout.tsx`** - Integrated PushNotificationPrompt

## Setup Instructions

### 1. Install Dependencies
```bash
cd dance_dispatch
npm install
```

### 2. Generate VAPID Keys
You need to generate VAPID (Voluntary Application Server Identification) keys for push notifications:

```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
Public Key: [long base64 string]
Private Key: [long base64 string]
```

### 3. Update Environment Variables
Add to `.env.local`:
```env
# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your-public-key>
VAPID_PRIVATE_KEY=<your-private-key>
VAPID_SUBJECT=mailto:your-email@example.com
PUSH_SEND_SECRET=<strong-random-secret-for-server-jobs>
```

### 4. Create Supabase Table
Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Create push_subscriptions table
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable RLS if your table uses it
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Service can manage subscriptions
CREATE POLICY "Service can manage subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 5. Install web-push (if not already done)
The dependency is in package.json. Just run npm install.

## Usage

### For Users
1. The `PushNotificationPrompt` component will appear after 7 days of dismissal
2. Users can enable/disable notifications from:
   - The prompt banner
   - Settings page (using `NotificationSettings` component)
3. Notifications work both in-app and when PWA is closed

### For Developers

#### Send Push Notifications
```typescript
// Server-side code
const response = await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-push-job-secret': process.env.PUSH_SEND_SECRET!,
  },
  body: JSON.stringify({
    userId: 'user-id-or-omit-for-all',
    notification: {
      title: 'Event Alert',
      body: 'New dance event in your area!',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-192.svg',
      tag: 'event-notification',
      url: '/events/event-id',
      data: {
        eventId: 'event-id',
        type: 'new-event'
      }
    }
  })
});
```

#### Use Push Notification Hook
```typescript
'use client';
import { usePushNotifications } from '@/app/hooks/usePushNotifications';

export function MyComponent() {
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  if (!isSupported) return <p>Not supported</p>;

  return (
    <button onClick={isSubscribed ? unsubscribe : subscribe}>
      {isSubscribed ? 'Disable' : 'Enable'} Notifications
    </button>
  );
}
```

### Add NotificationSettings to Profile Page
```typescript
// In your settings/profile page
import { NotificationSettings } from '@/app/components/NotificationSettings';

export default function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <NotificationSettings />
    </div>
  );
}
```

## Notification Payload Structure

Push notifications support the following data:
```typescript
interface PushNotificationPayload {
  title: string;           // Notification title
  body: string;           // Notification body text
  icon?: string;          // Icon URL
  badge?: string;         // Badge URL (for Android)
  tag?: string;           // Grouping tag
  url?: string;           // URL to open on click
  data?: Record<string, any>; // Custom metadata
}
```

## Integration Examples

### Send Event Notifications
```typescript
// When a new event is created
await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-push-job-secret': process.env.PUSH_SEND_SECRET!,
  },
  body: JSON.stringify({
    notification: {
      title: `New Event: ${eventTitle}`,
      body: `${eventVenue} • ${eventDate}`,
      icon: '/icons/icon-192.svg',
      url: `/events/${eventId}`,
      tag: `event-${eventId}`,
      data: { eventId, type: 'new-event' }
    }
  })
});
```

### Send Saved Event Updates
```typescript
// When a saved event has updates
await fetch('/api/push-notifications/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-push-job-secret': process.env.PUSH_SEND_SECRET!,
  },
  body: JSON.stringify({
    userId: userThatSavedEvent.id,
    notification: {
      title: 'Event Update',
      body: `Details changed for ${eventTitle}`,
      icon: '/icons/icon-192.svg',
      url: `/events/${eventId}`,
      tag: `event-update-${eventId}`,
      requireInteraction: true
    }
  })
});
```

## Browser Support
- ✅ Chrome/Edge (Android & Desktop)
- ✅ Firefox
- ✅ Opera
- ⚠️ Safari (limited - iOS doesn't support Web Push, macOS has partial support)
- ✅ PWA mode on all platforms

## Testing

### Enable Test Notifications
Test notifications using the utility function:
```typescript
import { showTestNotification } from '@/lib/push-notifications';

await showTestNotification('Test Notification', {
  body: 'This is a test',
  tag: 'test'
});
```

### Browser DevTools
1. Open DevTools → Application tab
2. Service Workers → Your service worker
3. Check "pushService" to simulate push events
4. Test with: `self.registration.showNotification('Test')`

## Security Considerations

1. **VAPID Keys**: Keep private key secret - never expose to frontend
2. **Authentication**: Subscription endpoints require user auth; send endpoint requires `PUSH_SEND_SECRET` and is intended for trusted server jobs only
3. **Encryption**: Web Push protocol automatically encrypts payload data
4. **User Control**: Users must explicitly grant permission
5. **Cleanup**: Invalid subscriptions (410/404) are automatically removed

## Troubleshooting

### Notifications not appearing
- Verify VAPID keys are set in environment
- Check browser notification permissions
- Ensure service worker is registered
- Check browser console for errors

### Subscriptions failing
- Verify user is authenticated
- Check Supabase `push_subscriptions` table exists
- Ensure RLS policies allow write access
- Check network requests in DevTools

### Service Worker issues
- Clear site data: DevTools → Application → Clear storage
- Unregister SW: DevTools → Application → Service Workers
- Reload page

## Performance Notes
- Subscriptions stored in IndexedDB by browser automatically
- Cleanup of dead subscriptions is automatic (410/404 responses)
- No database queries on cold start
- Push events handled entirely in service worker

## Future Enhancements
- Add notification categories (events, messages, promotions)
- Implement notification preferences per user
- Add scheduled notification support
- Integrate with event reminders
- Add rich notification templates
