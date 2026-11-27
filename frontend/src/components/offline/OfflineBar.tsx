import { WifiOff } from "lucide-react";

import { useOffline } from "@/lib/offline/use-offline";

/**
 * The line under a page's top bar while the phone is offline, in the campaign banners' style:
 * what it shows is what this phone kept (`lib/offline/`), and nothing new loads or saves.
 */
export default function OfflineBar() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-accent-line bg-accent-soft px-4 py-1.5 text-sm text-ink"
    >
      <WifiOff className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="min-w-0">You&rsquo;re offline. Showing what this phone last saw.</span>
    </div>
  );
}
