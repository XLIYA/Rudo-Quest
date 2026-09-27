"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AppIconButton } from "./app-icon-button";

export type AppDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Purpose: Render a spacious centered modal dialog.
 * Inputs: Controlled open state, title, optional description, and content.
 * Output: Accessible Radix dialog with a responsive work area.
 * Side effects: Locks focus while open.
 */
export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: AppDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
        <Dialog.Content className="dialog-surface fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(96vw,62rem)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-overlay)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold tracking-[-0.02em]">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-text-secondary">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <AppIconButton label="Close dialog">
                <X className="size-5" />
              </AppIconButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
