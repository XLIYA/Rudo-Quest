import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import { createTask, moveTask, updateTask } from "./task-service";

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
  deliverPushBestEffort: vi.fn(),
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
    taskType: "TASK",
    priority: "NONE",
    parentTaskId: null,
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

describe("createTask assignment defaults", () => {
  const payload = {
    projectId: targetProjectId,
    title: "Project task",
    scheduledDate: "2026-07-10",
    scheduledTimeZone: "UTC",
  } as const;

  beforeEach(() => {
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "MEMBER",
      archivedAt: null,
    });
    projectRepository.isProjectMember.mockResolvedValue(true);
    taskRepository.insertTask.mockResolvedValue(task({ projectId: targetProjectId }));
  });

  it("defaults an omitted project assignee to the creator", async () => {
    await createTask(userId, payload);

    expect(taskRepository.insertTask).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: userId }),
      transaction.executor,
    );
  });

  it("preserves an explicit unassigned project task", async () => {
    await createTask(userId, { ...payload, assigneeId: null });

    expect(taskRepository.insertTask).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: null }),
      transaction.executor,
    );
  });

  it("delivers an assignment notification when another member is assigned", async () => {
    const assignedTask = task({
      projectId: targetProjectId,
      assignee: {
        id: "00000000-0000-4000-8000-000000000099",
        handle: "collaborator",
        displayName: "Collaborator",
        avatarUrl: null,
      },
    });
    const notification = {
      id: "00000000-0000-4000-8000-000000000020",
      type: "TASK_ASSIGNED",
      title: "Task assigned",
      body: assignedTask.title,
      href: `/weekly?date=${assignedTask.scheduledDate}&task=${assignedTask.id}`,
      readAt: null,
      createdAt: "2026-07-10T00:00:00.000Z",
    };
    taskRepository.insertTask.mockResolvedValue(assignedTask);
    notificationService.createNotification.mockResolvedValue(notification);

    await createTask(userId, {
      ...payload,
      assigneeId: assignedTask.assignee?.id,
    });

    expect(notificationService.deliverPushBestEffort).toHaveBeenCalledWith(
      notification,
      assignedTask.assignee?.id,
    );
  });
});

describe("createTask hierarchy authorization", () => {
  const parentId = "00000000-0000-4000-8000-000000000030";

  it("rejects a subtask when its parent Story is not visible", async () => {
    taskRepository.findTaskDto.mockResolvedValue(null);

    await expect(
      createTask(userId, {
        projectId: null,
        parentTaskId: parentId,
        taskType: "TASK",
        priority: "NONE",
        title: "Hidden child",
        scheduledDate: "2026-08-08",
        scheduledTimeZone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(taskRepository.insertTask).not.toHaveBeenCalled();
  });

  it("rejects a subtask whose parent does not share its scope", async () => {
    taskRepository.findTaskDto.mockResolvedValue(
      task({ id: parentId, taskType: "STORY", projectId: null }),
    );
    projectRepository.findProjectAccess.mockResolvedValue({
      role: "MEMBER",
      archivedAt: null,
    });

    await expect(
      createTask(userId, {
        projectId: targetProjectId,
        parentTaskId: parentId,
        taskType: "TASK",
        priority: "NONE",
        title: "Wrong scope",
        scheduledDate: "2026-08-08",
        scheduledTimeZone: "UTC",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(taskRepository.insertTask).not.toHaveBeenCalled();
  });
});

describe("moveTask Kanban transitions", () => {
  it("moves an in-progress task back to TODO with optimistic concurrency", async () => {
    const current = task({ status: "IN_PROGRESS", version: 3 });
    const moved = task({ status: "TODO", version: 4 });
    taskRepository.findTaskDto.mockResolvedValue(current);
    taskRepository.updateTaskRow.mockResolvedValue(moved);

    await expect(moveTask(userId, current.id, 3, "TODO")).resolves.toEqual(moved);

    expect(taskRepository.updateTaskRow).toHaveBeenCalledWith(
      current.id,
      3,
      { status: "TODO", previousStatus: null, completedAt: null },
      userId,
      transaction.executor,
    );
    expect(activityRepository.createActivityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "TASK_REOPENED", taskId: current.id }),
      transaction.executor,
    );
  });

  it("rejects a stale explicit move", async () => {
    const current = task({ version: 4 });
    taskRepository.findTaskDto.mockResolvedValue(current);

    await expect(moveTask(userId, current.id, 3, "DONE")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(taskRepository.updateTaskRow).not.toHaveBeenCalled();
  });
});
