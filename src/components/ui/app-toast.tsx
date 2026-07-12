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
) {
  if (tone === "success") return toast.success(message);
  if (tone === "error") return toast.error(message);
  if (tone === "warning") return toast.warning(message);
  return toast.info(message);
}
