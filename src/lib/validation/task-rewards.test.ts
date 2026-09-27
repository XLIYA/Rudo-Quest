import { describe, expect, it } from "vitest";
import { createTaskRewardSchema } from "./task-rewards";
import { createTaskSchema, updateTaskSchema } from "./tasks";

describe("task effort and reward validation", () => {
  const task = { title: "Task", scheduledDate: "2026-10-01", scheduledTimeZone: "UTC" };
  it.each([0, 6, 1.5, "3", null])("rejects invalid difficulty %s", (difficulty) => {
    expect(createTaskSchema.safeParse({ ...task, difficulty }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ version: 1, difficulty }).success).toBe(false);
  });
  it("defaults new task effort and accepts all five levels", () => {
    expect(createTaskSchema.parse(task).difficulty).toBe(1);
    for (let difficulty = 1; difficulty <= 5; difficulty++)
      expect(updateTaskSchema.parse({ version: 1, difficulty }).difficulty).toBe(
        difficulty,
      );
  });
  const reward = {
    title: "Goal",
    amountToman: 10_000_000,
    deadline: "2099-01-01T12:00:00+03:30",
    tasks: [
      { id: "00000000-0000-4000-8000-000000000001", version: 1 },
      { id: "00000000-0000-4000-8000-000000000002", version: 2 },
    ],
  };
  it("accepts total toman amount and an explicit timezone", () =>
    expect(createTaskRewardSchema.safeParse(reward).success).toBe(true));
  it.each([0, -1, 1.2, 1_000_000_000_001])("rejects invalid amount %s", (amountToman) =>
    expect(createTaskRewardSchema.safeParse({ ...reward, amountToman }).success).toBe(
      false,
    ),
  );
  it("rejects duplicate, single, and unversioned selections", () => {
    for (const tasks of [
      [reward.tasks[0]],
      [reward.tasks[0], reward.tasks[0]],
      [{ id: reward.tasks[0]!.id }, reward.tasks[1]],
    ])
      expect(createTaskRewardSchema.safeParse({ ...reward, tasks }).success).toBe(false);
  });
});
