import { toast } from "sonner";

/**
 * Purpose: Provide a local toast wrapper around Sonner.
 * Inputs: Message and optional tone.
 * Output: Toast ID from Sonner.
 * Side effects: Announces toast through aria-live region.
 */
export function AppToast(
  message: string,
  tone: "success" | "error" | "info" | "warning" = "info",
  options?: { action?: { label: string; onClick: () => void } },
) {
  if (tone === "success") return toast.success(message, options);
  if (tone === "error") return toast.error(message, options);
  if (tone === "warning") return toast.warning(message, options);
  return toast.info(message, options);
}
