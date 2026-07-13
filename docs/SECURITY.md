# Security

Supabase Auth sessions use HTTP-only SSR cookies. Client-provided user IDs are ignored for authorization; the server resolves identity through Supabase on every protected request.

State-changing API routes verify same-origin requests, validate inputs with Zod, enforce project/task permissions server-side, and never return raw database errors. API failures use the standard `{ error, requestId }` envelope.

Rate limiting uses Upstash Redis in production and a bounded local fallback in development. Production without Upstash returns `INTEGRATION_NOT_CONFIGURED` instead of silently allowing unlimited sensitive traffic.

Secrets are server-only. The Supabase service role key, GitHub private key, GitHub installation tokens, VAPID private key, Cron secret, and Upstash token are never exposed to the browser.

Content Security Policy with per-request script/style nonces, frame denial, nosniff, strict referrer policy, and a restrictive permissions policy are applied in `src/proxy.ts`. Scripts never permit `unsafe-inline`, and production never permits `unsafe-eval`. React's bounded progress and project-color values use the separately constrained `style-src-attr`; stylesheet injection remains nonce-restricted.

Hosted PostgreSQL connections require certificate verification. State-changing requests require a same-origin `Origin` header; cron and GitHub webhooks use their own bearer/HMAC authentication. JSON and webhook request bodies are streamed with hard byte limits, and production rate limiting uses Upstash Redis or fails closed with `INTEGRATION_NOT_CONFIGURED`.

GitHub installation state is signed, persisted, short-lived, bound to the current Rudo user, and atomically consumed. The OAuth authorization leg stores an encrypted short-lived user token only on the server; callback replay and installation takeover are rejected. Installation ownership is verified against GitHub's user-installations API before persistence.

Database defense in depth includes RLS on every public application table, revoked `anon`/`authenticated` table grants because browser data access goes through the server API, a non-recursive membership helper, project-owner integrity, project-member-only assignees, personal-task ownership, task completion normalization, and optimistic version increments.

Permission matrix:

| Action                    | Owner | Admin            | Member | Viewer |
| ------------------------- | ----- | ---------------- | ------ | ------ |
| View project              | Yes   | Yes              | Yes    | Yes    |
| Update project            | Yes   | Yes              | No     | No     |
| Archive project           | Yes   | No               | No     | No     |
| Invite users              | Yes   | Yes              | No     | No     |
| Remove member             | Yes   | Yes except owner | No     | No     |
| Change member role        | Yes   | Limited          | No     | No     |
| Create project task       | Yes   | Yes              | Yes    | No     |
| Edit any task             | Yes   | Yes              | No     | No     |
| Edit assigned task        | Yes   | Yes              | Yes    | No     |
| Assign tasks              | Yes   | Yes              | Yes    | No     |
| Complete assigned task    | Yes   | Yes              | Yes    | No     |
| Connect GitHub repository | Yes   | Yes              | No     | No     |
