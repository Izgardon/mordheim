type Registrar = { registerServiceWorker: () => void };

/**
 * Registers the service worker (docs/plans/offline.md, phase 2) in a production build only: never
 * under `npm run dev`, where it would serve stale modules over hot reload, nor in the tests. Its
 * code loads after the page, outside the entry bundle.
 */
export function startServiceWorker(
  production: boolean = import.meta.env.PROD,
  load: () => Promise<Registrar> = () => import("./register-sw")
) {
  if (!production || !("serviceWorker" in navigator)) return;
  void load()
    .then(({ registerServiceWorker }) => registerServiceWorker())
    .catch(() => undefined); // no worker this visit; the next load tries again
}
