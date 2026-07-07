"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AppIconButton } from "./app-icon-button";

export type AppSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
};

/**
 * Purpose: Render a responsive bottom/mobile and side/desktop task sheet.
 * Inputs: Controlled open state, title, and content.
 * Output: Accessible Radix dialog sheet.
 * Side effects: Locks focus while open.
 */
export function AppSheet({ open, onOpenChange, title, children }: AppSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-auto rounded-t-lg border border-border bg-surface p-5 shadow-[var(--shadow-overlay)] md:inset-y-0 md:left-auto md:right-0 md:w-[32rem] md:rounded-none">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <AppIconButton label="Close sheet">
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
