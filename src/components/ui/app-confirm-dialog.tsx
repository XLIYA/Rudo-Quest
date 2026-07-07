"use client";

import { AppButton } from "./app-button";
import { AppDialog } from "./app-dialog";

export type AppConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

/**
 * Purpose: Render a destructive confirmation dialog.
 * Inputs: Controlled state, copy, and confirm callback.
 * Output: Dialog with cancel and confirm actions.
 * Side effects: Invokes confirm callback on explicit confirmation.
 */
export function AppConfirmDialog(props: AppConfirmDialogProps) {
  return (
    <AppDialog open={props.open} onOpenChange={props.onOpenChange} title={props.title}>
      <p className="text-sm leading-6 text-text-secondary">{props.description}</p>
      <div className="mt-6 flex justify-end gap-2">
        <AppButton variant="secondary" onClick={() => props.onOpenChange(false)}>
          Cancel
        </AppButton>
        <AppButton variant="danger" onClick={props.onConfirm}>
          {props.confirmLabel}
        </AppButton>
      </div>
    </AppDialog>
  );
}
