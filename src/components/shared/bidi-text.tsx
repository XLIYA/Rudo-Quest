import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Purpose: Isolate dynamic text and let the browser determine its base direction.
 * Inputs: Text content and optional styling or explicit direction.
 * Output: A bidirectional-isolated text span.
 * Side effects: None.
 */
export function BidiText({
  children,
  className,
  direction = "auto",
}: {
  children: ReactNode;
  className?: string;
  direction?: "auto" | "ltr" | "rtl";
}) {
  return (
    <bdi dir={direction} className={cn("bidi-text", className)}>
      {children}
    </bdi>
  );
}
