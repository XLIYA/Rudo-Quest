"use client";

import * as Avatar from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils/cn";

export type AppAvatarProps = {
  name: string;
  src?: string | null;
  className?: string;
};

/**
 * Purpose: Render an accessible avatar with initials fallback.
 * Inputs: Display name, optional image source, and className.
 * Output: Token-styled avatar.
 * Side effects: None.
 */
export function AppAvatar({ name, src, className }: AppAvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <Avatar.Root className={cn("inline-flex size-9 items-center justify-center overflow-hidden rounded-md bg-brand-soft text-xs font-bold text-brand", className)}>
      {src ? <Avatar.Image src={src} alt={name} className="size-full object-cover" /> : null}
      <Avatar.Fallback>{initials || "RQ"}</Avatar.Fallback>
    </Avatar.Root>
  );
}
