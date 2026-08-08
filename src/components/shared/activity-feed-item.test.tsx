import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ActivityEventDto } from "@/types/domain";
import { ActivityFeedItem } from "./activity-feed-item";

const taskEvent = {
  id: "00000000-0000-4000-8000-000000000001",
  actor: {
    id: "00000000-0000-4000-8000-000000000002",
    handle: "mina",
    displayName: "Mina",
    avatarUrl: null,
  },
  projectId: "00000000-0000-4000-8000-000000000003",
  taskId: "00000000-0000-4000-8000-000000000004",
  eventType: "TASK_UPDATED",
  label: "updated a task",
  createdAt: "2026-08-08T08:00:00.000Z",
  task: {
    id: "00000000-0000-4000-8000-000000000004",
    title: "Fix invitation race",
    scheduledDate: "2026-08-08",
    archivedAt: null,
  },
} satisfies ActivityEventDto;

describe("ActivityFeedItem", () => {
  it("names and links an active task to its dated weekly detail", () => {
    render(<ActivityFeedItem event={taskEvent} todayDate="2026-08-08" />);

    expect(screen.getByText("Fix invitation race")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open task Fix invitation race" }),
    ).toHaveAttribute(
      "href",
      "/weekly?date=2026-08-08&task=00000000-0000-4000-8000-000000000004",
    );
  });

  it("routes missed and archived task context to the matching history view", () => {
    const { rerender } = render(
      <ActivityFeedItem
        event={{
          ...taskEvent,
          task: { ...taskEvent.task, scheduledDate: "2026-08-07" },
        }}
        todayDate="2026-08-08"
      />,
    );
    expect(screen.getByRole("link", { name: /Open task/ })).toHaveAttribute(
      "href",
      "/task-history?view=missed&task=00000000-0000-4000-8000-000000000004",
    );

    rerender(
      <ActivityFeedItem
        event={{
          ...taskEvent,
          task: { ...taskEvent.task, archivedAt: "2026-08-08T09:00:00.000Z" },
        }}
        todayDate="2026-08-08"
      />,
    );
    expect(screen.getByRole("link", { name: /Open task/ })).toHaveAttribute(
      "href",
      "/task-history?view=archived&task=00000000-0000-4000-8000-000000000004",
    );
  });

  it("omits task context for project-only events", () => {
    render(
      <ActivityFeedItem
        event={{ ...taskEvent, taskId: null, task: null, eventType: "PROJECT_UPDATED" }}
        todayDate="2026-08-08"
      />,
    );

    expect(screen.queryByRole("link", { name: /Open task/ })).not.toBeInTheDocument();
  });
});
