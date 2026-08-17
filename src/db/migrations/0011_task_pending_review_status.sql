-- Add PENDING_REVIEW to the task status lifecycle.
-- Mirrors src/db/schema/index.ts: tasks.status now allows PENDING_REVIEW and
-- previous_status may remember a PENDING_REVIEW state before completion/reopen.

alter table tasks
  drop constraint if exists tasks_status,
  drop constraint if exists tasks_previous_status;
alter table tasks
  add constraint tasks_status
    check (status in ('TODO','IN_PROGRESS','PENDING_REVIEW','DONE')) not valid,
  add constraint tasks_previous_status
    check (previous_status is null
      or previous_status in ('TODO','IN_PROGRESS','PENDING_REVIEW')) not valid;
alter table tasks validate constraint tasks_status;
alter table tasks validate constraint tasks_previous_status;
