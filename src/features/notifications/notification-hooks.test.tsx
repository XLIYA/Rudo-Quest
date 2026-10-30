import { act, renderHook } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  type InfiniteData,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import type { NotificationDto, NotificationPageDto } from "@/types/domain";
import { useReadNotifications } from "./notification-hooks";

const apiMutation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  apiMutation,
  apiGet: vi.fn(),
  normalizeApiClientError: () => ({ message: "Read failed" }),
}));
vi.mock("@/components/ui/app-toast", () => ({ AppToast: vi.fn() }));

const notifications: NotificationDto[] = [
  {
    id: "notification-1",
    type: "TASK_ASSIGNED",
    title: "Assigned task",
    body: null,
    href: null,
    readAt: null,
    createdAt: "2026-10-30T12:00:00.000Z",
  },
  {
    id: "notification-2",
    type: "DAILY_DIGEST",
    title: "Daily digest",
    body: null,
    href: null,
    readAt: null,
    createdAt: "2026-10-29T12:00:00.000Z",
  },
];

describe("useReadNotifications", () => {
  it("updates the cached unread badge when a notification is marked read", async () => {
    apiMutation.mockResolvedValueOnce({ ...notifications[0], readAt: "2026-10-30" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const key = queryKeys.notifications;
    client.setQueryData<InfiniteData<NotificationPageDto>>(key, {
      pages: [{ items: notifications, unreadCount: 2 }],
      pageParams: [""],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useReadNotifications(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: "notification-1" });
    });

    const updated = client.getQueryData<InfiniteData<NotificationPageDto>>(key)?.pages[0];
    expect(updated?.unreadCount).toBe(1);
    expect(updated?.items[0]?.readAt).not.toBeNull();
    expect(updated?.items[1]?.readAt).toBeNull();
  });
});
