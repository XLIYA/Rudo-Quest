"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

export type AppTooltipProps = {
  label: string;
  children: ReactNode;
};

/**
 * Purpose: Provide accessible hover/focus explanatory text.
 * Inputs: Tooltip label and trigger child.
 * Output: Radix tooltip.
 * Side effects: None.
 */
export function AppTooltip({ label, children }: AppTooltipProps) {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="z-50 rounded-md bg-text-primary px-2 py-1 text-xs text-background">
            {label}
            <Tooltip.Arrow className="fill-text-primary" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
