import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import { updateTask } from "./task-service";

const taskRepository = vi.hoisted(() => ({
  findTaskDto: vi.fn(),
  insertTask: vi.fn(),
  listTaskActivity: vi.fn(),
  listWeekTasks: vi.fn(),
  updateTaskRow: vi.fn(),
}));

const projectRepository = vi.hoisted(() => ({
  findProjectAccess: vi.fn(),
  findProjectRole: vi.fn(),
  isProjectMember: vi.fn(),
}));

const transaction = vi.hoisted(() => ({
  executor: {},
  runDbTransaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) =>
    operation(transaction.executor),
  ),
}));

const activityRepository = vi.hoisted(() => ({
  createActivityEvent: vi.fn(),
}));

const notificationService = vi.hoisted(() => ({
  createNotification: vi.fn(),
}));

vi.mock("@/server/repositories/task-repository", () => taskRepository);
vi.mock("@/server/repositories/project-repository", () => projectRepository);
vi.mock("@/server/repositories/activity-repository", () => activityRepository);
vi.mock("@/server/services/notification-service", () => notificationService);
vi.mock("@/lib/db/client", () => ({
  runDbTransaction: transaction.runDbTransaction,
}));

const userId = "00000000-0000-4000-8000-000000000001";
const targetProjectId = "00000000-0000-4000-8000-000000000002";

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    projectId: null,
    createdBy: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    assignee: { id: userId, handle: "owner", displayName: "Owner", avatarUrl: null },
    title: "Personal task",
    description: null,
    iconKey: null,
    status: "TODO",
    previousStatus: null,
    scheduledDate: "2026-07-10",
    scheduledTime: null,
    scheduledTimeZone: "UTC",
    completedAt: null,
    archivedAt: null,
    version: 1,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    permissions: {
      canEditDetails: true,
      canTransition: true,
      canArchive: true,
    },
    project: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  taskRepository.findTaskDto.mockResolvedValue(task());
});

describe("updateTask project reassignment authorization", () => {
  it("rejects moving a task into a project where the actor has no role", async () => {
    projectRepository.findProjectAccess.mockResolvedValue(null);

    await expect(
      updateTask(userId, "00000000-0000-4000-8000-000000000010", {
        version: 1,
        projectId: targetProjectId,
        assigneeId: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(taskRepository.updateTaskRow).not.toHaveBeenCalled();
  });

  it("rejects moving a task into a project where the actor is only a viewer", async () => {
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "VIEWER",
      archivedAt: null,
    });

    await expect(
      updateTask(userId, "00000000-0000-4000-8000-000000000010", {
        version: 1,
        projectId: targetProjectId,
        assigneeId: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(taskRepository.updateTaskRow).not.toHaveBeenCalled();
  });

  it("allows moving a task into a project where the actor can create tasks", async () => {
    const updated = task({ projectId: targetProjectId });
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "MEMBER",
      archivedAt: null,
    });
    taskRepository.updateTaskRow.mockResolvedValue(updated);

    await expect(
      updateTask(userId, "00000000-0000-4000-8000-000000000010", {
        version: 1,
        projectId: targetProjectId,
        assigneeId: null,
      }),
    ).resolves.toEqual(updated);

    expect(taskRepository.updateTaskRow).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000010",
      1,
      { projectId: targetProjectId, assigneeId: null },
      userId,
      transaction.executor,
    );
  });
});
