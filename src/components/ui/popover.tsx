"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils/cn";

/** Purpose: Compose the shadcn popover. Inputs: Radix props. Output: Accessible popover primitive. Side effects: Manages focus and open state. Source: shadcn/ui (MIT). */
const Popover = PopoverPrimitive.Root;

/** Purpose: Compose the shadcn popover. Inputs: Radix props. Output: Accessible popover primitive. Side effects: Manages focus and open state. Source: shadcn/ui (MIT). */
const PopoverTrigger = PopoverPrimitive.Trigger;

/** Purpose: Compose the shadcn popover. Inputs: Radix props. Output: Accessible popover primitive. Side effects: Manages focus and open state. Source: shadcn/ui (MIT). */
const PopoverAnchor = PopoverPrimitive.Anchor;

/** Purpose: Compose the shadcn popover. Inputs: Radix props. Output: Accessible popover primitive. Side effects: Manages focus and open state. Source: shadcn/ui (MIT). */
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={12}
      className={cn(
        "z-[70] w-auto max-h-[var(--radix-popover-content-available-height)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-surface p-0 text-text-primary shadow-[var(--shadow-raised)] outline-none",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
