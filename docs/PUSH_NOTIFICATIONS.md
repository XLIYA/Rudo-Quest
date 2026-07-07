# Push Notifications

Generate VAPID keys and set:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Users opt in from profile/settings. The app never requests browser notification permission on first load. Push subscriptions are stored per browser/device in `push_subscriptions`.

Notification payloads avoid private task descriptions and use safe title/body text. Delivery attempts are logged in `notification_deliveries`; 404 and 410 push failures remove dead subscriptions.

The scheduled endpoint is `POST /api/cron/notifications` and requires:

```text
Authorization: Bearer CRON_SECRET
```
