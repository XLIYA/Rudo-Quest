import { beforeEach, describe, expect, it, vi } from "vitest";
import { actOnTaskReward, createTaskReward, getTaskRewards } from "./task-reward-service";

const repo = vi.hoisted(() => ({
  lockRewardAccess: vi.fn(),
  lockRewardTasks: vi.fn(),
  insertTaskReward: vi.fn(),
  lockTaskReward: vi.fn(),
  finishTaskReward: vi.fn(),
  listTaskRewards: vi.fn(),
}));
const access = vi.hoisted(() => vi.fn());
const activity = vi.hoisted(() => vi.fn());
vi.mock("@/server/repositories/task-reward-repository", () => repo);
vi.mock("@/server/repositories/project-repository", () => ({
  findProjectAccess: access,
}));
vi.mock("@/server/repositories/activity-repository", () => ({
  createActivityEvent: activity,
}));
vi.mock("@/lib/db/client", () => ({
  runDbTransaction: (fn: (tx: object) => unknown) => fn({}),
}));

const input = {
  title: "Weekly goal",
  amountToman: 10_000_000,
  deadline: "2099-01-01T12:00:00Z",
  tasks: [
    { id: "a", version: 2 },
    { id: "b", version: 3 },
  ],
};
const rows = () =>
  input.tasks.map((task) => ({
    ...task,
    projectId: "project",
    archivedAt: null,
    rewardId: null,
    status: "TODO",
  }));

describe("project reward contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.lockRewardAccess.mockResolvedValue({ role: "ADMIN", archivedAt: null });
    repo.lockRewardTasks.mockResolvedValue(rows());
    repo.insertTaskReward.mockResolvedValue("reward");
    repo.lockTaskReward.mockResolvedValue({
      id: "reward",
      version: 1,
      status: "ACTIVE",
      taskIds: ["a", "b"],
      deadline: new Date(input.deadline),
    });
  });
  it("creates one total and activity event for the selected versions", async () => {
    await expect(createTaskReward("admin", "project", input)).resolves.toEqual({
      id: "reward",
    });
    expect(repo.insertTaskReward).toHaveBeenCalledWith("admin", "project", input, {});
    expect(activity).toHaveBeenCalledOnce();
  });
  it.each(["MEMBER", "VIEWER", null])("denies creation by %s", async (role) => {
    repo.lockRewardAccess.mockResolvedValue({ role, archivedAt: null });
    await expect(createTaskReward("user", "project", input)).rejects.toMatchObject({
      status: 403,
    });
    expect(repo.insertTaskReward).not.toHaveBeenCalled();
  });
  it.each([
    { projectId: "other" },
    { version: 99 },
    { rewardId: "existing" },
    { archivedAt: new Date() },
    { status: "DONE" },
  ])("rejects unavailable task %j", async (override) => {
    repo.lockRewardTasks.mockResolvedValue([{ ...rows()[0], ...override }, rows()[1]]);
    await expect(createTaskReward("admin", "project", input)).rejects.toMatchObject({
      status: 409,
    });
    expect(repo.insertTaskReward).not.toHaveBeenCalled();
  });
  it("rejects past deadlines and archived projects", async () => {
    await expect(
      createTaskReward("admin", "project", {
        ...input,
        deadline: "2000-01-01T00:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 400 });
    repo.lockRewardAccess.mockResolvedValue({ role: "OWNER", archivedAt: new Date() });
    await expect(createTaskReward("admin", "project", input)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("does not approve a partially completed contract", async () => {
    await expect(
      actOnTaskReward("admin", "project", "reward", 1, "approve"),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.finishTaskReward).not.toHaveBeenCalled();
  });
  it("approves only all completed tasks before deadline", async () => {
    repo.lockRewardTasks.mockResolvedValue(
      rows().map((task) => ({
        ...task,
        rewardId: "reward",
        status: "DONE",
        completedAt: new Date(),
      })),
    );
    await expect(
      actOnTaskReward("admin", "project", "reward", 1, "approve"),
    ).resolves.toEqual({ id: "reward" });
    expect(repo.finishTaskReward).toHaveBeenCalledWith(
      expect.anything(),
      "admin",
      "approve",
      {},
    );
  });
  it("rejects late approval and stale action versions", async () => {
    repo.lockTaskReward.mockResolvedValue({
      id: "reward",
      version: 1,
      status: "ACTIVE",
      taskIds: ["a", "b"],
      deadline: new Date(0),
    });
    await expect(
      actOnTaskReward("admin", "project", "reward", 1, "approve"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      actOnTaskReward("admin", "project", "reward", 2, "cancel"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("allows cancellation of incomplete contracts", async () => {
    await expect(
      actOnTaskReward("admin", "project", "reward", 1, "cancel"),
    ).resolves.toEqual({ id: "reward" });
    expect(repo.finishTaskReward).toHaveBeenCalledWith(
      expect.anything(),
      "admin",
      "cancel",
      {},
    );
  });
  it("does not disclose rewards to nonmembers", async () => {
    access.mockResolvedValue(null);
    await expect(getTaskRewards("stranger", "project")).rejects.toMatchObject({
      status: 403,
    });
    expect(repo.listTaskRewards).not.toHaveBeenCalled();
  });
});
