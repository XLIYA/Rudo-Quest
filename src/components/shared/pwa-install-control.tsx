"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AppButton } from "@/components/ui/app-button";
import { AppToast } from "@/components/ui/app-toast";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/**
 * Purpose: Surface the browser-owned PWA installation prompt only after a user action.
 * Inputs: None.
 * Output: Device installation status and an install control when the browser permits it.
 * Side effects: Listens for install lifecycle events and may open the browser install prompt.
 * Failure behavior: Keeps the browser-menu guidance visible and reports prompt failures.
 */
export function PwaInstallControl() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pending, setPending] = useState(false);
  const standalone = useSyncExternalStore(
    subscribeToDisplayMode,
    readStandaloneDisplayMode,
    () => false,
  );
  const isInstalled = installed || standalone;

  useEffect(() => {
    /**
     * Purpose: Retain the browser install prompt until the user explicitly chooses install.
     * Inputs: Before-install browser event.
     * Output: Void.
     * Side effects: Prevents the automatic prompt and stores the event in component state.
     */
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    /**
     * Purpose: Reflect successful installation in the settings UI.
     * Inputs: Browser app-installed event.
     * Output: Void.
     * Side effects: Updates installation state and releases the saved prompt.
     */
    const markInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  /**
   * Purpose: Open the saved browser install prompt after an explicit click.
   * Inputs: None.
   * Output: Promise resolving after the browser records the choice.
   * Side effects: Opens browser UI and displays success/failure feedback.
   */
  const install = async () => {
    if (!promptEvent) return;
    setPending(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice.outcome === "accepted") {
        setInstalled(true);
        AppToast("Rudo Quest was installed on this device.", "success");
      }
    } catch {
      AppToast("The browser could not open the install prompt.", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-3">
      <p className="text-sm text-text-secondary">
        {isInstalled
          ? "Rudo Quest is installed on this device."
          : promptEvent
            ? "Install Rudo Quest for a focused, app-like experience."
            : "If installation is supported, use your browser menu and choose Install app or Add to Home Screen."}
      </p>
      {!isInstalled && promptEvent ? (
        <AppButton className="w-fit" onClick={() => void install()} disabled={pending}>
          {pending ? "Opening install prompt…" : "Install Rudo Quest"}
        </AppButton>
      ) : null}
    </div>
  );
}

/**
 * Purpose: Subscribe React to standalone display-mode changes.
 * Inputs: React store-change callback.
 * Output: Cleanup callback.
 * Side effects: Adds and removes one media-query listener.
 */
function subscribeToDisplayMode(onStoreChange: () => void): () => void {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

/**
 * Purpose: Read whether the current browser window is running as an installed PWA.
 * Inputs: None.
 * Output: True when display mode is standalone.
 * Side effects: None.
 */
function readStandaloneDisplayMode(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}
