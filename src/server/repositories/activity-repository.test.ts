import { describe, expect, it } from "vitest";
import { canViewActivityRow } from "./activity-repository";

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
