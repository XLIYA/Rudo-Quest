import type { ProjectRole, TaskStatus } from "@/types/domain";
import { AppError } from "@/lib/api/errors";

const roleRank: Record<ProjectRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Purpose: Check whether a project role has at least the required authority.
 * Inputs: Actual project role and minimum role.
 * Output: True when the actual role meets or exceeds the minimum role.
 * Side effects: None.
 */
export function hasProjectRole(role: ProjectRole | null, minimum: ProjectRole): boolean {
  if (!role) return false;
  return roleRank[role] >= roleRank[minimum];
}

/**
 * Purpose: Enforce a project permission in service code.
 * Inputs: Actual role, minimum role, and public failure message.
 * Output: Void when allowed.
 * Side effects: None.
 * Failure behavior: Throws FORBIDDEN when the role is insufficient.
 */
export function assertProjectRole(
  role: ProjectRole | null,
  minimum: ProjectRole,
  message = "You do not have permission for this project action.",
): void {
  if (!hasProjectRole(role, minimum)) {
    throw new AppError("FORBIDDEN", 403, message);
  }
}

/**
 * Purpose: Enforce task mutation permissions for project tasks.
 * Inputs: User ID, role, assignee ID, and whether editing all fields is required.
 * Output: Void when allowed.
 * Side effects: None.
 * Business rule: Owners/admins can edit any task; members can mutate only assigned task controls.
 */
export function assertCanMutateTask(
  userId: string,
  role: ProjectRole | null,
  assigneeId: string | null,
  editAny: boolean,
): void {
  if (role === "OWNER" || role === "ADMIN") return;
  if (role === "MEMBER" && !editAny && assigneeId === userId) return;
  throw new AppError("FORBIDDEN", 403, "You do not have permission to mutate this task.");
}

/**
 * Purpose: Compute the next status and completion timestamp for a checkbox toggle.
 * Inputs: Current status, previous non-done status, and current clock.
 * Output: Next status tuple used by task services.
 * Side effects: None.
 * Business rule: Unchecking DONE restores the previous non-done status.
 */
export function toggleCompletionState(
  status: TaskStatus,
  previousStatus: Exclude<TaskStatus, "DONE"> | null,
  now: Date,
): {
  status: TaskStatus;
  previousStatus: Exclude<TaskStatus, "DONE"> | null;
  completedAt: Date | null;
} {
  if (status === "DONE") {
    return {
      status: previousStatus ?? "TODO",
      previousStatus: null,
      completedAt: null,
    };
  }
  return {
    status: "DONE",
    previousStatus: status,
    completedAt: now,
  };
}
