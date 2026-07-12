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
 * Purpose: Fetch one project summary.
 * Inputs: Project ID.
 * Output: TanStack Query result.
 * Side effects: Performs browser HTTP GET.
 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) => apiGet<ProjectSummary>(`/api/projects/${projectId}`, signal),
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
