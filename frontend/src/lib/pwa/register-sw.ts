import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";

import { isOffline } from "@/lib/offline/use-offline";

export const UPDATE_NOTICE_ID = "app-update";
/** How often an open app asks for a new version, besides each time it comes to the front. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;
/** Reload anyway when the new version hasn't taken over this soon after Reload. */
const TAKEOVER_WAIT_MS = 3_000;

/**
 * The notice for a new version waiting on the phone: "A new version is ready." with Reload. Nothing
 * reloads by itself (a reload mid-battle would lose what the player is typing); left alone, the new
 * version takes over at the next cold start. It hides while offline, because a reload then would
 * open the new build with none of this phone's saved reads (their buster is the build), and closed,
 * it stays closed.
 */
export function createUpdateNotice(reload: () => void, signal?: AbortSignal) {
  let waiting = false;
  let closed = false;
  let hidden = false; // by going offline: sonner reports that dismissal later, as the player's own

  const show = () => {
    if (!waiting || closed || isOffline()) return;
    hidden = false;
    toast("A new version is ready.", {
      id: UPDATE_NOTICE_ID,
      duration: Infinity,
      action: { label: "Reload", onClick: reload },
      onDismiss: () => {
        if (!hidden) closed = true;
      },
    });
  };
  const hide = () => {
    hidden = true;
    toast.dismiss(UPDATE_NOTICE_ID);
  };
  window.addEventListener("online", show, { signal });
  window.addEventListener("offline", hide, { signal });

  return {
    /** A new version is installed and waiting. */
    waiting() {
      waiting = true;
      show();
    },
  };
}

/**
 * Asks for a new version when the app comes to the front, when the signal returns and every
 * `every` ms, while online.
 */
export function checkForUpdates(registration: ServiceWorkerRegistration, every = UPDATE_CHECK_MS) {
  const check = () => {
    if (isOffline() || registration.installing) return;
    void registration.update().catch(() => undefined);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check();
  });
  window.addEventListener("online", check);
  window.setInterval(check, every);
}

/** Registers the worker; lib/pwa/start.ts loads this in a production build only. */
export function registerServiceWorker() {
  // Reload only for this page's own Reload: another window's tap moves this one onto the new
  // worker too, and it carries on (a page it can't load then says "The app was updated").
  let requested = false;
  const reload = () => {
    requested = true;
    void updateServiceWorker();
    window.setTimeout(() => window.location.reload(), TAKEOVER_WAIT_MS);
  };
  const notice = createUpdateNotice(reload);
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => notice.waiting(),
    onNeedReload: () => {
      if (requested) window.location.reload();
    },
    onRegisteredSW: (_url, registration) => {
      if (registration) checkForUpdates(registration);
    },
  });
}
