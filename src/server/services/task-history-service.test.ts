import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import { getTaskHistory, restoreTask } from "./task-history-service";

const historyRepository = vi.hoisted(() => ({
  listTaskHistory: vi.fn(),
}));
const taskRepository = vi.hoisted(() => ({
  restoreTaskRow: vi.fn(),
  rollUpStoryStatus: vi.fn(),
}));
const profileRepository = vi.hoisted(() => ({
  findProfileById: vi.fn(),
}));
const projectRepository = vi.hoisted(() => ({
  findProjectAccess: vi.fn(),
}));
const taskService = vi.hoisted(() => ({
  getVisibleTask: vi.fn(),
}));
const activityRepository = vi.hoisted(() => ({
  createActivityEvent: vi.fn(),
}));
const transaction = vi.hoisted(() => ({
  executor: {},
  runDbTransaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) =>
    operation(transaction.executor),
  ),
}));

vi.mock("@/server/repositories/task-history-repository", () => historyRepository);
vi.mock("@/server/repositories/task-repository", () => taskRepository);
vi.mock("@/server/repositories/profile-repository", () => profileRepository);
vi.mock("@/server/repositories/project-repository", () => projectRepository);
vi.mock("@/server/services/task-service", () => taskService);
vi.mock("@/server/repositories/activity-repository", () => activityRepository);
vi.mock("@/lib/db/client", () => ({
  runDbTransaction: transaction.runDbTransaction,
}));

const userId = "00000000-0000-4000-8000-000000000001";
const taskId = "00000000-0000-4000-8000-000000000010";

function archivedTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: taskId,
    projectId: null,
    createdBy: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    assignee: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    title: "Archived task",
    description: null,
    iconKey: null,
    taskType: "TASK",
    priority: "NONE",
    parentTaskId: null,
    subtaskTotal: 0,
    subtaskCompleted: 0,
    subtaskProgressPercent: 0,
    status: "TODO",
    previousStatus: null,
    scheduledDate: "2026-08-07",
    scheduledTime: null,
    scheduledTimeZone: "UTC",
    completedAt: null,
    archivedAt: "2026-08-08T00:00:00.000Z",
    version: 2,
    createdAt: "2026-08-07T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    permissions: {
      canEditDetails: true,
      canCreateSubtasks: true,
      canTransition: true,
      canArchive: true,
    },
    project: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  profileRepository.findProfileById.mockResolvedValue({ timeZone: "Asia/Tehran" });
  historyRepository.listTaskHistory.mockResolvedValue({ items: [] });
  taskService.getVisibleTask.mockResolvedValue(archivedTask());
  taskRepository.restoreTaskRow.mockResolvedValue(
    archivedTask({ archivedAt: null, version: 3 }),
  );
  taskRepository.rollUpStoryStatus.mockResolvedValue({
    story: null,
    transition: null,
  });
});

describe("getTaskHistory", () => {
  it("uses the viewer profile timezone to calculate the missed cutoff", async () => {
    vi.setSystemTime(new Date("2026-08-08T21:30:00.000Z"));

    await getTaskHistory(userId, { view: "missed" });

    expect(historyRepository.listTaskHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        view: "missed",
        todayDate: "2026-08-09",
      }),
    );
    vi.useRealTimers();
  });
});

describe("restoreTask", () => {
  it("restores an archived task and records activity in the same transaction", async () => {
    await expect(restoreTask(userId, taskId, 2)).resolves.toMatchObject({
      id: taskId,
      archivedAt: null,
      version: 3,
    });
    expect(taskRepository.restoreTaskRow).toHaveBeenCalledWith(
      taskId,
      2,
      userId,
      transaction.executor,
    );
    expect(activityRepository.createActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TASK_RESTORED", taskId }),
      transaction.executor,
    );
  });

  it("rejects restore inside an archived project", async () => {
    taskService.getVisibleTask.mockResolvedValue(
      archivedTask({
        projectId: "00000000-0000-4000-8000-000000000020",
        project: {
          id: "00000000-0000-4000-8000-000000000020",
          title: "Old project",
          colorKey: "orange",
          iconKey: "Compass",
        },
      }),
    );
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "OWNER",
      archivedAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    await expect(restoreTask(userId, taskId, 2)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(taskRepository.restoreTaskRow).not.toHaveBeenCalled();
  });

  it("rejects restore without mutation permission", async () => {
    taskService.getVisibleTask.mockResolvedValue(
      archivedTask({
        permissions: {
          canEditDetails: false,
          canCreateSubtasks: false,
          canTransition: false,
          canArchive: false,
        },
      }),
    );

    await expect(restoreTask(userId, taskId, 2)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects restoring a Subtask while its Story is archived", async () => {
    const storyId = "00000000-0000-4000-8000-000000000030";
    taskService.getVisibleTask
      .mockResolvedValueOnce(archivedTask({ parentTaskId: storyId }))
      .mockResolvedValueOnce(
        archivedTask({
          id: storyId,
          taskType: "STORY",
          parentTaskId: null,
          archivedAt: "2026-08-01T00:00:00.000Z",
        }),
      );

    await expect(restoreTask(userId, taskId, 2)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(taskRepository.restoreTaskRow).not.toHaveBeenCalled();
  });

  it("recalculates the Story after restoring an active Subtask", async () => {
    const storyId = "00000000-0000-4000-8000-000000000031";
    taskService.getVisibleTask
      .mockResolvedValueOnce(archivedTask({ parentTaskId: storyId }))
      .mockResolvedValueOnce(
        archivedTask({
          id: storyId,
          taskType: "STORY",
          parentTaskId: null,
          archivedAt: null,
        }),
      );
    taskRepository.restoreTaskRow.mockResolvedValue(
      archivedTask({ parentTaskId: storyId, archivedAt: null, version: 3 }),
    );

    await restoreTask(userId, taskId, 2);

    expect(taskRepository.rollUpStoryStatus).toHaveBeenCalledWith(
      storyId,
      userId,
      transaction.executor,
    );
  });
});
