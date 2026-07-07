"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { NotificationDto } from "@/types/domain";

/**
 * Purpose: Fetch notification center data.
 * Inputs: None.
 * Output: TanStack Query result.
 * Side effects: Performs browser HTTP GET.
 */
export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => apiGet<NotificationDto[]>("/api/notifications", signal),
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
    mutationFn: (input: { id?: string; all?: boolean }): Promise<NotificationDto | { count: number }> =>
      input.all
        ? apiMutation<{ count: number }>("post", "/api/notifications/read-all")
        : apiMutation<NotificationDto>("patch", `/api/notifications/${input.id}/read`),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationDto[]>(queryKeys.notifications) ?? [];
      const now = new Date().toISOString();
      queryClient.setQueryData<NotificationDto[]>(
        queryKeys.notifications,
        previous.map((notification) =>
          input.all || notification.id === input.id ? { ...notification, readAt: notification.readAt ?? now } : notification,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(queryKeys.notifications, context?.previous ?? []);
      toast.error(normalizeApiClientError(error).message);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
