import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { tasks, taskRewards, projects, projectMemberships } from "@/db/schema";
import { getDb, type DbExecutor } from "@/lib/db/client";
import type { CreateTaskRewardInput } from "@/lib/validation/task-rewards";
import type { TaskRewardDto } from "@/types/domain";

/** Purpose: Lock project access during reward writes. Inputs: Actor, project, transaction. Output: Role/archive state. Side effects: Acquires share locks until commit. */
export async function lockRewardAccess(
  userId: string,
  projectId: string,
  tx: DbExecutor,
) {
  const [row] = await tx
    .select({ role: projectMemberships.role, archivedAt: projects.archivedAt })
    .from(projectMemberships)
    .innerJoin(projects, eq(projects.id, projectMemberships.projectId))
    .where(and(eq(projects.id, projectId), eq(projectMemberships.userId, userId)))
    .for("share");
  return row;
}

/** Purpose: Read reward groups and completion counts without per-task requests. Inputs: Project. Output: DTO list. Side effects: Reads rewards and tasks. */
export async function listTaskRewards(projectId: string): Promise<TaskRewardDto[]> {
  const rows = await getDb()
    .select({
      reward: taskRewards,
      completedCount:
        sql<number>`(select count(*) from ${tasks} where ${tasks.id} = any(${taskRewards.taskIds}) and ${tasks.status} = 'DONE' and ${tasks.archivedAt} is null)`.mapWith(
          Number,
        ),
    })
    .from(taskRewards)
    .where(eq(taskRewards.projectId, projectId))
    .orderBy(desc(taskRewards.createdAt));
  const ids = [...new Set(rows.flatMap(({ reward }) => reward.taskIds))];
  const includedTasks = ids.length
    ? await getDb()
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, ids)))
    : [];
  const taskMap = new Map(includedTasks.map((task) => [task.id, task]));
  return rows.map(({ reward, completedCount }) => ({
    ...reward,
    status: reward.status as TaskRewardDto["status"],
    deadline: reward.deadline.toISOString(),
    approvedAt: reward.approvedAt?.toISOString() ?? null,
    completedCount: reward.status === "APPROVED" ? reward.taskIds.length : completedCount,
    includedTasks: reward.taskIds.map(
      (id) => taskMap.get(id) ?? { id, title: "Unavailable task" },
    ),
  }));
}

/** Purpose: Lock selected tasks in stable order. Inputs: IDs and transaction. Output: Stored rows. Side effects: Acquires row locks. */
export function lockRewardTasks(ids: string[], tx: DbExecutor) {
  return tx
    .select()
    .from(tasks)
    .where(inArray(tasks.id, ids))
    .orderBy(asc(tasks.id))
    .for("update");
}

/** Purpose: Create a reward contract and attach all selected versions atomically. Inputs: Actor/project, validated contract, transaction. Output: Reward ID. Side effects: Inserts reward and bumps task versions. */
export async function insertTaskReward(
  userId: string,
  projectId: string,
  input: CreateTaskRewardInput,
  tx: DbExecutor,
) {
  const [reward] = await tx
    .insert(taskRewards)
    .values({
      projectId,
      createdBy: userId,
      title: input.title,
      amountToman: input.amountToman,
      deadline: new Date(input.deadline),
      taskIds: input.tasks.map((task) => task.id),
    })
    .returning();
  await tx
    .update(tasks)
    .set({
      rewardId: reward!.id,
      version: sql`${tasks.version} + 1`,
      updatedAt: new Date(),
    })
    .where(inArray(tasks.id, reward!.taskIds));
  return reward!.id;
}

/** Purpose: Lock one reward for versioned actions. Inputs: Project/reward and transaction. Output: Stored reward. Side effects: Locks row. */
export async function lockTaskReward(projectId: string, id: string, tx: DbExecutor) {
  const [reward] = await tx
    .select()
    .from(taskRewards)
    .where(and(eq(taskRewards.id, id), eq(taskRewards.projectId, projectId)))
    .for("update");
  return reward;
}

/** Purpose: Persist approval or cancellation. Inputs: Locked reward, actor, action, transaction. Output: Void. Side effects: Updates reward; cancellation releases task assignments. */
export async function finishTaskReward(
  reward: typeof taskRewards.$inferSelect,
  userId: string,
  action: "approve" | "cancel",
  tx: DbExecutor,
) {
  await tx
    .update(taskRewards)
    .set({
      status: action === "approve" ? "APPROVED" : "CANCELLED",
      version: reward.version + 1,
      ...(action === "approve" ? { approvedAt: new Date(), approvedBy: userId } : {}),
    })
    .where(eq(taskRewards.id, reward.id));
  if (action === "cancel")
    await tx
      .update(tasks)
      .set({ rewardId: null, version: sql`${tasks.version} + 1`, updatedAt: new Date() })
      .where(eq(tasks.rewardId, reward.id));
}
