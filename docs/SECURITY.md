# Security

Supabase Auth sessions use HTTP-only SSR cookies. Client-provided user IDs are ignored for authorization; the server resolves identity through Supabase on every protected request.

State-changing API routes verify same-origin requests, validate inputs with Zod, enforce project/task permissions server-side, and never return raw database errors. API failures use the standard `{ error, requestId }` envelope.

Rate limiting uses Upstash Redis in production and a bounded local fallback in development. Production without Upstash returns `INTEGRATION_NOT_CONFIGURED` instead of silently allowing unlimited sensitive traffic.

Secrets are server-only. The Supabase service role key, GitHub private key, GitHub installation tokens, VAPID private key, Cron secret, and Upstash token are never exposed to the browser.

Content Security Policy, frame denial, nosniff, strict referrer policy, and restrictive permissions policy are configured in `next.config.ts`.

Permission matrix:

| Action | Owner | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| View project | Yes | Yes | Yes | Yes |
| Update project | Yes | Yes | No | No |
| Archive project | Yes | No | No | No |
| Invite users | Yes | Yes | No | No |
| Remove member | Yes | Yes except owner | No | No |
| Change member role | Yes | Limited | No | No |
| Create project task | Yes | Yes | Yes | No |
| Edit any task | Yes | Yes | No | No |
| Edit assigned task | Yes | Yes | Yes | No |
| Assign tasks | Yes | Yes | Yes | No |
| Complete assigned task | Yes | Yes | Yes | No |
| Connect GitHub repository | Yes | Yes | No | No |
