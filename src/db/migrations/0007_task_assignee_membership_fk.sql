-- Serialize task assignment against concurrent project member removal.
-- A composite foreign key from tasks(project_id, assignee_id) to
-- project_memberships(project_id, user_id) makes it impossible to commit an
-- assignment to a user who is not (or no longer) a member of that project,
-- closing the race window between "remove member" and "assign task" without
-- needing explicit row locks.
alter table tasks
  add constraint tasks_assignee_membership_fk
    foreign key (project_id, assignee_id)
    references project_memberships (project_id, user_id)
    on delete no action;

-- The retry query filters on status = 'FAILED', but the partial index only
-- covered 'PENDING'/'RETRYING' rows, so retries never used the index. Widen
-- the predicate to match what listRetryableNotificationDeliveries() queries.
drop index if exists notification_deliveries_retry_idx;
create index notification_deliveries_retry_idx
  on notification_deliveries(next_retry_at, created_at)
  where status in ('PENDING', 'RETRYING', 'FAILED');
