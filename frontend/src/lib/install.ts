import { useSyncExternalStore } from "react";

/**
 * Installing the app on a phone (William, 25 Nov 2026: "installable as a pwa on android and on apple phones").
 * Chrome on Android offers its own prompt, kept here from the moment it fires (main.tsx imports this first)
 * so Account → Appearance can show Install; an iPhone has no prompt, only Share → Add to Home Screen.
 */
type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** What Install can do here: nothing (installed, or no way in this browser), prompt, or tell an iPhone how. */
export type InstallState = "installed" | "prompt" | "ios" | "none";

let deferred: PromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());

function standalone() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function isIosSafari() {
  const agent = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(agent) || (agent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(agent);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // shown from Account instead of a banner over the page
    deferred = event as PromptEvent;
    announce();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    announce();
  });
}

export function installState(): InstallState {
  if (installed || standalone()) return "installed";
  if (deferred) return "prompt";
  return isIosSafari() ? "ios" : "none";
}

/** Shows the browser's own install prompt; true when the player installed. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  announce();
  return outcome === "accepted";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useInstallState = () =>
  useSyncExternalStore(subscribe, installState, () => "none" as const);
