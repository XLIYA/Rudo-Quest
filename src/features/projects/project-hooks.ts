"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  ProjectColorKey,
  ProjectIconKey,
  ProjectRole,
  ProjectSummary,
} from "@/types/domain";

/**
 * Purpose: Fetch project list data.
 * Inputs: Optional query string.
 * Output: TanStack Query result.
 * Side effects: Performs browser HTTP GET.
 */
export function useProjects(search = "") {
  return useQuery({
    queryKey: [...queryKeys.projects, search],
    queryFn: ({ signal }) => apiGet<ProjectSummary[]>(`/api/projects${search}`, signal),
  });
}

/**
 * Purpose: Fetch all projects for use in selectors/comboboxes.
 * Uses a longer staleTime since project lists change infrequently.
 * Inputs: None.
 * Output: TanStack Query result for all active projects.
 * Side effects: Performs browser HTTP GET.
 */
export function useAllProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiGet<ProjectSummary[]>("/api/projects", signal),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Purpose: Create a project without optimistic updates.
 * Inputs: Validated project form payload.
 * Output: TanStack mutation.
 * Side effects: Sends POST and invalidates project list.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description?: string | null;
      iconKey: ProjectIconKey;
      colorKey: ProjectColorKey;
      timeZone: string;
      invitations: { userId: string; role: Exclude<ProjectRole, "OWNER"> }[];
    }) => apiMutation<ProjectSummary>("post", "/api/projects", body),
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}
