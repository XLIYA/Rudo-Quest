# Changelog

## 1.0.0 — 2026-09-28

### Added

- Task difficulty from 1 to 5, with accessible controls and compact visual indicators.
- Project reward groups with a total toman amount, a deadline, multi-task selection,
  admin approval, cancellation and transactional concurrency protection.

### Improved

- Desktop dashboard sizing, including smaller laptop viewports.
- Mobile navigation, week controls, task cards, project headers and member controls.
- shadcn calendar/popover date controls and separate reward deadline time selection.
- More informative Kanban cards and compact project progress summaries.
- Minimal notification rows and accurate unread totals.
- On-demand task editor loading, deferred archive queries and reduced-motion-aware animation.

### Fixed

- Stale dashboard/project/history data after task restoration.
- Invalid empty filter options, cleared-date form crashes, and cross-platform migration checksums.
- Full-width mobile Archive action and task DTO cache compatibility.
- Existing shell hydration, offline mutation rejection, dialog and combobox fixes
  are included in this release.

See [the release review](docs/release-v1-review.md) for behavior, verification scope
and migration requirements.
