import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-hover",
        secondary:
          "border border-border bg-surface text-text-primary hover:bg-surface-muted",
        ghost: "text-text-secondary hover:bg-surface-muted hover:text-text-primary",
        danger: "bg-error text-error-contrast hover:opacity-90",
      },
      size: {
        sm: "min-h-11 px-3 text-xs",
        md: "min-h-11 px-4",
        lg: "min-h-12 px-5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

/**
 * Purpose: Provide the local typed button wrapper used throughout Rudo Quest.
 * Inputs: Native button props, variant, size, and optional Radix Slot behavior.
 * Output: Styled accessible button.
 * Side effects: None.
 */
export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const buttonProps = asChild ? props : { type: "button" as const, ...props };
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...buttonProps}
      />
    );
  },
);
AppButton.displayName = "AppButton";
