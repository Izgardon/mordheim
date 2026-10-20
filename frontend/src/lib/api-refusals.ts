/**
 * Refusals the whole app reacts to, whichever screen sent the request: today 403
 * `campaign_archived` (decision 5), which the campaign layout toasts before reading the campaign
 * again. `apiRequest` reports every failed request here; listeners pick what they care about.
 */
type RefusalListener = (error: unknown) => void;

const listeners = new Set<RefusalListener>();

export function onApiRefusal(listener: RefusalListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportApiRefusal(error: unknown) {
  listeners.forEach((listener) => listener(error));
}
