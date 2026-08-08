import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaskCreateSheet } from "./task-create-sheet";

const mutateAsync = vi.hoisted(() => vi.fn());
vi.mock("@/features/tasks/task-hooks", () => ({
  useCreateTask: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("./task-assignee-combobox", () => ({
  TaskAssigneeCombobox: ({ onChange }: { onChange: (value: string | null) => void }) => (
    <button type="button" onClick={() => onChange(null)}>
      Leave unassigned
    </button>
  ),
}));

describe("TaskCreateSheet", () => {
  it("keeps project scope fixed and creates an unassigned classified task", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mutateAsync.mockResolvedValueOnce({ id: "created" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <TaskCreateSheet
          open
          project={{
            id: "00000000-0000-4000-8000-000000000020",
            title: "Launch",
            timeZone: "Asia/Tehran",
          }}
          scheduledDate="2026-08-08"
          onOpenChange={onOpenChange}
          onCreated={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByLabelText("Project")).toBeDisabled();
    expect(screen.getByText("Leave unassigned")).toBeVisible();
    await user.type(screen.getByLabelText("Title"), "Ship onboarding");
    await user.click(screen.getByRole("button", { name: "Create task" }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ship onboarding",
        projectId: "00000000-0000-4000-8000-000000000020",
        assigneeId: null,
        taskType: "TASK",
        priority: "NONE",
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
