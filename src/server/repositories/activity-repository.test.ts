import { describe, expect, it } from "vitest";
import { canViewActivityRow, mapActivityTaskContext } from "./activity-repository";

const userId = "00000000-0000-4000-8000-000000000001";

describe("canViewActivityRow", () => {
  it("allows project activity only when the user is a current project member", () => {
    expect(
      canViewActivityRow(userId, {
        actorId: "00000000-0000-4000-8000-000000000002",
        projectId: "00000000-0000-4000-8000-000000000003",
        viewerUserId: userId,
        taskProjectId: null,
        taskCreatedBy: null,
        taskAssigneeId: null,
      }),
    ).toBe(true);

    expect(
      canViewActivityRow(userId, {
        actorId: userId,
        projectId: "00000000-0000-4000-8000-000000000003",
        viewerUserId: null,
        taskProjectId: null,
        taskCreatedBy: null,
        taskAssigneeId: null,
      }),
    ).toBe(false);
  });

  it("allows personal activity for the actor or related personal task", () => {
    expect(
      canViewActivityRow(userId, {
        actorId: userId,
        projectId: null,
        viewerUserId: null,
        taskProjectId: null,
        taskCreatedBy: null,
        taskAssigneeId: null,
      }),
    ).toBe(true);

    expect(
      canViewActivityRow(userId, {
        actorId: "00000000-0000-4000-8000-000000000002",
        projectId: null,
        viewerUserId: null,
        taskProjectId: null,
        taskCreatedBy: null,
        taskAssigneeId: userId,
      }),
    ).toBe(true);
  });
});

describe("mapActivityTaskContext", () => {
  it("includes enough task context for an unambiguous activity destination", () => {
    expect(
      mapActivityTaskContext({
        taskId: "00000000-0000-4000-8000-000000000004",
        taskTitle: "Fix invitation race",
        taskScheduledDate: "2026-08-07",
        taskArchivedAt: new Date("2026-08-08T09:00:00.000Z"),
      }),
    ).toEqual({
      id: "00000000-0000-4000-8000-000000000004",
      title: "Fix invitation race",
      scheduledDate: "2026-08-07",
      archivedAt: "2026-08-08T09:00:00.000Z",
    });
  });

  it("returns null for activity without a joined task", () => {
    expect(
      mapActivityTaskContext({
        taskId: null,
        taskTitle: null,
        taskScheduledDate: null,
        taskArchivedAt: null,
      }),
    ).toBeNull();
  });
});
