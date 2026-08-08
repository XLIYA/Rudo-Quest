"use client";

import { FileText, Link2, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  useCreateTaskLinkAttachment,
  useDeleteTaskAttachment,
  useTaskAttachments,
  useUploadTaskAttachment,
} from "@/features/tasks/task-attachment-hooks";
import type { TaskAttachmentDto, TaskDto } from "@/types/domain";
import { AppButton } from "./app-button";
import { AppConfirmDialog } from "./app-confirm-dialog";
import { AppInput } from "./app-input";
import { AppSkeleton } from "./app-skeleton";

const accept =
  ".jpg,.jpeg,.png,.webp,.gif,.avif,.pdf,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.gz,.tar";

function formatBytes(value: number | null): string {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function TaskAttachments({
  task,
  open,
  offline,
}: {
  task: TaskDto;
  open: boolean;
  offline: boolean;
}) {
  const attachments = useTaskAttachments(task.id, open);
  const createLink = useCreateTaskLinkAttachment(task.id);
  const upload = useUploadTaskAttachment(task.id);
  const remove = useDeleteTaskAttachment(task.id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TaskAttachmentDto | null>(null);
  const editable = task.permissions.canEditDetails && !task.archivedAt;

  const submitLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    try {
      await createLink.mutateAsync({ label: linkLabel.trim(), url: linkUrl.trim() });
      setLinkLabel("");
      setLinkUrl("");
      setAddingLink(false);
    } catch {
      // Keep the draft visible for correction or retry.
    }
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) await upload.mutateAsync(file).catch(() => undefined);
  };

  return (
    <section className="mt-5 grid gap-4 rounded-lg border border-border bg-surface-muted/35 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Paperclip className="size-4" aria-hidden="true" />
            Attachments
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Private files up to 10 MiB, or external http(s) references.
          </p>
        </div>
        {editable ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept={accept}
              onChange={selectFile}
              disabled={offline || upload.isPending}
              aria-label="Choose attachment file"
            />
            <AppButton
              variant="secondary"
              size="sm"
              disabled={offline || upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-4" aria-hidden="true" />
              {upload.isPending ? "Uploading…" : "Upload file"}
            </AppButton>
            <AppButton
              variant="secondary"
              size="sm"
              disabled={offline}
              onClick={() => setAddingLink((current) => !current)}
            >
              {addingLink ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {addingLink ? "Cancel" : "Add link"}
            </AppButton>
          </div>
        ) : null}
      </header>

      {addingLink ? (
        <form
          className="grid gap-3 rounded-md border border-border bg-surface p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] sm:items-end"
          onSubmit={submitLink}
        >
          <AppInput
            label="Link label"
            value={linkLabel}
            onChange={(event) => setLinkLabel(event.currentTarget.value)}
            maxLength={140}
            required
            disabled={createLink.isPending}
          />
          <AppInput
            label="URL"
            type="url"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.currentTarget.value)}
            maxLength={2048}
            placeholder="https://…"
            required
            disabled={createLink.isPending}
          />
          <AppButton
            type="submit"
            disabled={createLink.isPending || !linkLabel.trim() || !linkUrl.trim()}
          >
            Add link
          </AppButton>
        </form>
      ) : null}

      {attachments.isLoading ? <AppSkeleton className="h-20" /> : null}
      {attachments.isError ? (
        <p role="alert" className="text-sm text-error">
          Attachments could not be loaded.
        </p>
      ) : null}
      {!attachments.isLoading && !attachments.isError && !attachments.data?.length ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-text-tertiary">
          No attachments yet.
        </p>
      ) : null}
      {attachments.data?.length ? (
        <ul className="grid gap-2">
          {attachments.data.map((attachment) => {
            const href =
              attachment.kind === "LINK" ? attachment.url : attachment.downloadUrl;
            return (
              <li
                key={attachment.id}
                className="flex min-w-0 items-center gap-3 rounded-md border border-border bg-surface p-3"
              >
                {attachment.kind === "LINK" ? (
                  <Link2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
                ) : (
                  <FileText className="size-4 shrink-0 text-brand" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  {href ? (
                    <a
                      className="block truncate font-medium text-brand underline-offset-4 hover:underline"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {attachment.label}
                    </a>
                  ) : (
                    <span className="block truncate font-medium">{attachment.label}</span>
                  )}
                  <p className="truncate text-xs text-text-tertiary">
                    {attachment.kind === "FILE"
                      ? `${attachment.mimeType ?? "File"} · ${formatBytes(attachment.sizeBytes)}`
                      : attachment.url}
                  </p>
                </div>
                {editable ? (
                  <AppButton
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${attachment.label}`}
                    disabled={offline || remove.isPending}
                    onClick={() => setPendingDelete(attachment)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </AppButton>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <AppConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Delete attachment?"
        description="This removes the attachment from the task. Uploaded files cannot be recovered."
        confirmLabel="Delete attachment"
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </section>
  );
}
