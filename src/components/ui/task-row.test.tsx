import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TaskDto } from "@/types/domain";
import { TaskRow } from "./task-row";

function task(): TaskDto {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: null,
    createdBy: {
      id: "00000000-0000-4000-8000-000000000002",
      handle: "owner",
      displayName: "Owner",
      avatarUrl: null,
    },
    assignee: null,
    title: "Review task row",
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
  };
}

describe("TaskRow", () => {
  it("does not open details when toggling completion", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onCompleteToggle = vi.fn();

    render(
      <TaskRow
        task={task()}
        onOpen={onOpen}
        onCompleteToggle={onCompleteToggle}
        onStart={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Complete Review task row" }));

    expect(onCompleteToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens details from the content button", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <TaskRow
        task={task()}
        onOpen={onOpen}
        onCompleteToggle={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Review task row/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
