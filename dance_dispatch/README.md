This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Host follows

Apply `supabase/host_follow_constraints.sql` before deploying the host-follow changes.
It replaces host-only uniqueness with uniqueness per user and host and removes an
incorrect host-to-venue foreign key if present. Existing follows are retained.

## Google Calendar review

Apply `supabase/rejected_calendar_events.sql` to the Supabase database before deploying
the calendar review changes. The migration moves pending rows with no local `event_id`
and a nonblank Google Calendar ID into the rejection table, regardless of `exclude`.
Rows without a Google ID are left untouched. Run the migration using a database role
that can create tables and functions. Calendar sync and review require
`SUPABASE_SERVICE_ROLE_KEY` on the server.

Deleting a pending calendar event permanently prevents its reimport without changing
Google Calendar. Manually submitted pending events without a Google ID are deleted normally.

Users can mark past events as attended after confirming attendance. This does not
award RSVP points; submitting a review still earns the usual review points. Event
end times are interpreted as Eastern wall-clock time for this decision.
If an earlier version of this migration was applied, rerun it before deploying to remove
the old restore-capable import function.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
