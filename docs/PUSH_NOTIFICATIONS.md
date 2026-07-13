# Push Notifications

Generate VAPID keys and set:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Users opt in from profile/settings. The app never requests browser notification permission on first load. Push subscriptions are stored per browser/device in `push_subscriptions`.

Notification payloads avoid private task descriptions and use safe title/body text. Delivery attempts are logged in `notification_deliveries`; 404 and 410 push failures remove dead subscriptions.

The scheduled endpoint supports `GET /api/cron/notifications` for Vercel Cron
and `POST /api/cron/notifications` for an authorized manual run. Both require:

```text
Authorization: Bearer CRON_SECRET
```

Vercel invokes the endpoint every 15 minutes. Each user is evaluated in their
configured IANA timezone, quiet hours are respected, and due-today plus daily
digest notifications use database unique dedupe keys. Delivery rows enforce
one notification/subscription pair, track attempts, use exponential backoff,
and remove subscriptions that return HTTP 404 or 410. Invitation acceptance
creates an owner notification. Browser permission is requested only from an
explicit Profile or Settings action.

Assignment, project-invitation, and invitation-acceptance notifications are
dispatched immediately after their database transaction commits. A failed push
delivery never rolls back the underlying product action; it is recorded for
retry and visible through delivery observability.
