import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProfileDto, TaskDto } from "@/types/domain";
import { ProjectDetailScreen } from "./project-detail-screen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const taskMutate = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ projectId: "00000000-0000-4000-8000-00000000c001" }),
  useRouter: () => router,
}));
vi.mock("@/hooks/use-online", () => ({ useOnline: () => true }));
vi.mock("@/features/tasks/task-hooks", () => ({
  useTaskMutation: () => ({
    mutate: taskMutate,
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  }),
  useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/tasks/task-history-hooks", () => ({
  useProjectArchivedTasks: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useRestoreTask: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Per-test API payloads keyed by path (query strings stripped); each test
// seeds only the endpoints its assertions depend on, the rest resolve to
// neutral values.
const api = vi.hoisted(() => ({ responses: {} as Record<string, unknown> }));
vi.mock("@/lib/api/client", () => ({
  apiGet: (url: string) => {
    const path = url.split("?")[0];
    const exact = api.responses[path as string];
    if (exact !== undefined) return Promise.resolve(exact);
    if (url.startsWith("/api/tasks/week")) return Promise.resolve([]);
    if (path === "/api/projects/00000000-0000-4000-8000-00000000c001")
      return Promise.resolve(projectResponse);
    if (url.startsWith("/api/projects/00000000-0000-4000-8000-00000000c001/members"))
      return Promise.resolve([]);
    if (url.startsWith("/api/projects/00000000-0000-4000-8000-00000000c001/invitations"))
      return Promise.resolve([]);
    if (url.startsWith("/api/activity")) return Promise.resolve({ items: [] });
    if (url === "/api/me") return Promise.resolve(profile);
    return Promise.resolve(undefined);
  },
}));

const projectId = "00000000-0000-4000-8000-00000000c001";

const profile: ProfileDto = {
  id: "00000000-0000-4000-8000-00000000a001",
  email: "owner@example.com",
  handle: "owner",
  displayName: "Owner",
  avatarPath: null,
  bannerPath: null,
  bannerPresetKey: null,
  themePreference: "system",
  timeZone: "UTC",
  notificationsEnabled: true,
  dailyReminderEnabled: false,
  dailyReminderTime: null,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
};

const profileSummary = {
  id: profile.id,
  handle: profile.handle,
  displayName: profile.displayName,
  avatarUrl: null,
};

const task = (overrides: Partial<TaskDto> = {}): TaskDto => ({
  id: "00000000-0000-4000-8000-00000000b001",
  projectId,
  createdBy: profileSummary,
  assignee: null,
  title: "Draft launch notes",
  description: null,
  iconKey: null,
  taskType: "TASK",
  priority: "MEDIUM",
  parentTaskId: null,
  subtaskTotal: 0,
  subtaskCompleted: 0,
  subtaskProgressPercent: 0,
  status: "TODO",
  previousStatus: null,
  scheduledDate: "2026-09-14",
  scheduledTime: null,
  scheduledTimeZone: "UTC",
  completedAt: null,
  archivedAt: null,
  version: 1,
  createdAt: "2026-09-01T08:00:00.000Z",
  updatedAt: "2026-09-01T08:00:00.000Z",
  project: {
    id: projectId,
    title: "Launch plan",
    colorKey: "orange",
    iconKey: "Rocket",
  },
  permissions: {
    canEditDetails: true,
    canCreateSubtasks: true,
    canTransition: true,
    canArchive: true,
  },
  ...overrides,
});

const projectResponse = {
  id: projectId,
  title: "Launch plan",
  description: null,
  iconKey: "Rocket",
  colorKey: "orange",
  timeZone: "UTC",
  role: "OWNER",
  openTaskCount: 0,
  completedThisWeek: 0,
  weeklyCompletionPercent: 0,
  githubRepositoryFullName: null,
  members: [],
  archivedAt: null,
  createdAt: "2026-09-01T08:00:00.000Z",
};

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectDetailScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.responses = {};
});

describe("ProjectDetailScreen board state", () => {
  it("renders the empty state and opens the create-task sheet for zero tasks", async () => {
    const user = userEvent.setup();
    renderScreen();

    expect(await screen.findByText("No tasks in this project yet")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Create first task" }));

    expect(
      await screen.findByRole("dialog", { name: "Create project task" }),
    ).toBeVisible();
  });

  it("renders the Kanban board once tasks exist", async () => {
    api.responses["/api/tasks/week"] = [task()];

    renderScreen();

    expect((await screen.findAllByText("Drop tasks here")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Draft launch notes")).length).toBeGreaterThan(0);
    expect(screen.queryByText("No tasks in this project yet")).toBeNull();
  });
});
