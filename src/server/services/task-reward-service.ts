import { AppError } from "@/lib/api/errors";
import { runDbTransaction } from "@/lib/db/client";
import type { CreateTaskRewardInput } from "@/lib/validation/task-rewards";
import { assertProjectRole } from "@/server/policies/project-policy";
import { findProjectAccess } from "@/server/repositories/project-repository";
import { createActivityEvent } from "@/server/repositories/activity-repository";
import {
  finishTaskReward,
  insertTaskReward,
  listTaskRewards,
  lockRewardAccess,
  lockRewardTasks,
  lockTaskReward,
} from "@/server/repositories/task-reward-repository";
import type { ProjectRole } from "@/types/domain";

/** Purpose: Read project reward contracts. Inputs: Actor/project. Output: Visible reward DTOs. Side effects: Reads membership and rewards. */
export async function getTaskRewards(userId: string, projectId: string) {
  const access = await findProjectAccess(projectId, userId);
  assertProjectRole(access?.role ?? null, "VIEWER");
  return listTaskRewards(projectId);
}

/** Purpose: Create one total reward for multiple unfinished tasks. Inputs: Actor/project and validated input. Output: Reward ID. Side effects: Atomically writes reward, task versions and activity. Failure behavior: Rejects stale, cross-project, archived or already rewarded tasks. */
export async function createTaskReward(
  userId: string,
  projectId: string,
  input: CreateTaskRewardInput,
) {
  return runDbTransaction(async (tx) => {
    const access = await lockRewardAccess(userId, projectId, tx);
    assertProjectRole(access?.role as ProjectRole | null, "ADMIN");
    if (access?.archivedAt)
      throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
    if (new Date(input.deadline).getTime() <= Date.now())
      throw new AppError("BAD_REQUEST", 400, "Choose a future deadline.");
    const rows = await lockRewardTasks(
      input.tasks.map((task) => task.id),
      tx,
    );
    const versions = new Map(input.tasks.map((task) => [task.id, task.version]));
    if (
      rows.length !== input.tasks.length ||
      rows.some(
        (task) =>
          task.projectId !== projectId ||
          task.archivedAt ||
          task.rewardId ||
          task.status === "DONE" ||
          task.version !== versions.get(task.id),
      )
    ) {
      throw new AppError(
        "CONFLICT",
        409,
        "Some tasks changed or are unavailable. Refresh your selection.",
      );
    }
    const id = await insertTaskReward(userId, projectId, input, tx);
    await createActivityEvent(
      {
        actorId: userId,
        projectId,
        eventType: "PROJECT_UPDATED",
        metadata: {
          rewardId: id,
          action: "reward_created",
          amountToman: input.amountToman,
        },
      },
      tx,
    );
    return { id };
  });
}

/** Purpose: Approve all selected completed tasks before the deadline or cancel an active contract. Inputs: Actor/project/reward, version and action. Output: Reward identity. Side effects: Writes contract and activity atomically. Business rule: The amount is a total in toman; approval records eligibility, without transferring money. */
export async function actOnTaskReward(
  userId: string,
  projectId: string,
  id: string,
  version: number,
  action: "approve" | "cancel",
) {
  return runDbTransaction(async (tx) => {
    const access = await lockRewardAccess(userId, projectId, tx);
    assertProjectRole(access?.role as ProjectRole | null, "ADMIN");
    if (access?.archivedAt)
      throw new AppError("CONFLICT", 409, "Archived projects are read-only.");
    const reward = await lockTaskReward(projectId, id, tx);
    if (!reward) throw new AppError("NOT_FOUND", 404, "Reward not found.");
    if (reward.version !== version || reward.status !== "ACTIVE")
      throw new AppError("CONFLICT", 409, "Reward changed. Refresh and try again.");
    const rows = await lockRewardTasks(reward.taskIds, tx);
    if (
      action === "approve" &&
      (Date.now() > reward.deadline.getTime() ||
        rows.length !== reward.taskIds.length ||
        rows.some(
          (task) =>
            task.projectId !== projectId ||
            task.rewardId !== id ||
            task.archivedAt ||
            task.status !== "DONE" ||
            !task.completedAt ||
            task.completedAt > reward.deadline,
        ))
    ) {
      throw new AppError(
        "CONFLICT",
        409,
        "Every selected task must be complete and approved before the deadline.",
      );
    }
    await finishTaskReward(reward, userId, action, tx);
    await createActivityEvent(
      {
        actorId: userId,
        projectId,
        eventType: "PROJECT_UPDATED",
        metadata: { rewardId: id, action: `reward_${action}` },
      },
      tx,
    );
    return { id };
  });
}
