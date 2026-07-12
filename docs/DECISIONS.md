# Decisions

Rudo Quest is intentionally smaller than Jira, ClickUp, Notion, or GitHub. The product centers on capture, weekly planning, single assignee ownership, project membership, notifications, and one GitHub repository connection.

Tasks use exactly `TODO`, `IN_PROGRESS`, and `DONE`. Completing stores `completed_at`; reopening restores the previous non-done status. Archive is soft deletion through `archived_at`.

Project colors use fixed keys instead of arbitrary hex values. The Rudo mark is an original compact explorer/check motif designed for 24px recognition and PWA icons.

Client state is TanStack Query only. No global task/project/profile store is used.

Route Handlers are used for browser mutations because the client uses Axios. Server-side code calls services and repositories directly.

The existing dashboard heatmap and font configuration are intentionally
preserved. Audit remediation does not reinterpret or regenerate those two
surfaces.
