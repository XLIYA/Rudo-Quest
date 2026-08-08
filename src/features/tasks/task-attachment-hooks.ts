"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppToast } from "@/components/ui/app-toast";
import { apiGet, apiMutation, normalizeApiClientError } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { taskAttachmentMimeByExtension } from "@/lib/task-attachment-types";
import type { TaskAttachmentDto } from "@/types/domain";

export function useTaskAttachments(taskId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.taskAttachments(taskId),
    queryFn: ({ signal }) =>
      apiGet<TaskAttachmentDto[]>(`/api/tasks/${taskId}/attachments`, signal),
    enabled: enabled && Boolean(taskId),
  });
}

function useInvalidateAttachments(taskId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(taskId) });
}

export function useCreateTaskLinkAttachment(taskId: string) {
  const invalidate = useInvalidateAttachments(taskId);
  return useMutation({
    mutationFn: (body: { label: string; url: string }) =>
      apiMutation<TaskAttachmentDto>("post", `/api/tasks/${taskId}/attachments`, body),
    onSuccess: () => void invalidate(),
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
}

export function useUploadTaskAttachment(taskId: string) {
  const invalidate = useInvalidateAttachments(taskId);
  return useMutation({
    mutationFn: async (file: File) => {
      if (!file.size || file.size > 10 * 1024 * 1024) {
        throw new Error("Choose a non-empty file no larger than 10 MiB.");
      }
      const extension = file.name.toLowerCase().split(".").at(-1);
      const allowedTypes = extension
        ? taskAttachmentMimeByExtension[extension]
        : undefined;
      if (!extension || !allowedTypes?.length)
        throw new Error("This file type is not allowed.");
      const contentType = allowedTypes.includes(file.type) ? file.type : allowedTypes[0];
      const upload = await apiMutation<{
        uploadId: string;
        path: string;
        token: string;
      }>("post", `/api/tasks/${taskId}/attachments/upload`, {
        fileName: file.name,
        contentType,
        size: file.size,
      });
      const result = await createSupabaseBrowserClient()
        .storage.from("task-attachments")
        .uploadToSignedUrl(upload.path, upload.token, file, {
          contentType,
          upsert: false,
        });
      if (result.error) throw new Error("File upload failed. Try again.");
      return apiMutation<TaskAttachmentDto>(
        "patch",
        `/api/tasks/${taskId}/attachments/upload`,
        { uploadId: upload.uploadId },
      );
    },
    onSuccess: () => void invalidate(),
    onError: (error) => AppToast(normalizeApiClientError(error).message, "error"),
  });
}

export function useDeleteTaskAttachment(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiMutation<{ deleted: true }>(
        "delete",
        `/api/tasks/${taskId}/attachments/${attachmentId}`,
      ),
    onMutate: async (attachmentId) => {
      const key = queryKeys.taskAttachments(taskId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskAttachmentDto[]>(key);
      queryClient.setQueryData<TaskAttachmentDto[]>(key, (current) =>
        current?.filter((item) => item.id !== attachmentId),
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      queryClient.setQueryData(queryKeys.taskAttachments(taskId), context?.previous);
      AppToast(normalizeApiClientError(error).message, "error");
    },
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.taskAttachments(taskId) }),
  });
}
