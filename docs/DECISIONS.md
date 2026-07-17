# Decisions

Rudo Quest is intentionally smaller than Jira, ClickUp, Notion, or GitHub. The product centers on capture, weekly planning, single assignee ownership, project membership, notifications, and one GitHub repository connection.

Tasks use exactly `TODO`, `IN_PROGRESS`, and `DONE`. Completing stores `completed_at`; reopening restores the previous non-done status. Archive is soft deletion through `archived_at`.

Project colors use fixed keys instead of arbitrary hex values. The Rudo mark is an original compact explorer/check motif designed for 24px recognition and PWA icons.

Client state is TanStack Query only. No global task/project/profile store is used.

Route Handlers are used for browser mutations so validation, authorization, and standard API envelopes stay at one server boundary. The browser uses the native Fetch API through one typed wrapper; server-side code calls services and repositories directly.

The 91-day heatmap layout is intentionally preserved because it gives the
compact activity signal the product needs. Noto Serif is loaded from local
Next.js font assets for all body, control, label, and data text to avoid layout
shift and third-party font requests. Bitcount Ink remains limited to the Rudo
Quest name, primary page titles, and prominent weekday headings.
