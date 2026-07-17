"use client";

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { NotificationDto, NotificationPageDto } from "@/types/domain";

/**
 * Purpose: Fetch notification center data.
 * Inputs: Optional server-fetched first page for hydration-safe protected navigation.
 * Output: TanStack Query result.
 * Side effects: Performs browser HTTP GET.
 */
export function useNotifications(initialPage?: NotificationPageDto) {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications,
    staleTime: 30_000,
    refetchOnMount: initialPage ? false : "always",
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    initialPageParam: "",
    queryFn: ({ signal, pageParam }) =>
      apiGet<NotificationPageDto>(
        `/api/notifications${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""}`,
        signal,
      ),
    getNextPageParam: (page) => page.cursor,
    ...(initialPage
      ? { initialData: { pages: [initialPage], pageParams: [""] } }
      : undefined),
  });
}

/**
 * Purpose: Optimistically mark notifications read.
 * Inputs: Notification ID or all flag.
 * Output: TanStack mutation.
 * Side effects: Mutates cache and calls read APIs.
 */
export function useReadNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      all?: boolean;
    }): Promise<NotificationDto | { count: number }> =>
      input.all
        ? apiMutation<{ count: number }>("post", "/api/notifications/read-all")
        : apiMutation<NotificationDto>("patch", `/api/notifications/${input.id}/read`),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<InfiniteData<NotificationPageDto>>(
        queryKeys.notifications,
      );
      const now = new Date().toISOString();
      queryClient.setQueryData<InfiniteData<NotificationPageDto>>(
        queryKeys.notifications,
        (current) => {
          if (!current) return current;
          const targetWasUnread = current.pages.some((page) =>
            page.items.some(
              (notification) =>
                notification.id === input.id && notification.readAt === null,
            ),
          );
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              unreadCount: input.all
                ? 0
                : Math.max(0, page.unreadCount - (targetWasUnread ? 1 : 0)),
              items: page.items.map((notification) =>
                input.all || notification.id === input.id
                  ? { ...notification, readAt: notification.readAt ?? now }
                  : notification,
              ),
            })),
          };
        },
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(queryKeys.notifications, context?.previous);
      AppToast(normalizeApiClientError(error).message, "error");
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
