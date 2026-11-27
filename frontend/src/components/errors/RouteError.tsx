import { Link, useLocation, useNavigate, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { useChunkFailureCause, type ChunkFailureCause } from "@/lib/chunk-failure";
import { getErrorMessage } from "@/lib/get-error-message";
import { isChunkLoadError, reloadApp } from "@/lib/reload-app";

type RouteErrorProps = {
  /** "page" covers the screen (root routes); "inline" replaces only a campaign page. */
  variant?: "page" | "inline";
};

/** What a page whose code didn't download says, by why it didn't. */
const CHUNK_STATES: Record<ChunkFailureCause, { title: string; message: string }> = {
  checking: { title: "This page didn't load", message: "Checking the connection…" },
  offline: {
    title: "No connection",
    message: "This page couldn't download. Reload once you have signal.",
  },
  updated: { title: "The app was updated", message: "Reload to get the latest version." },
};

/**
 * errorElement for the routes (IMP-11): a render error shows this instead of blanking the app.
 * Retry re-renders the route; a page's code that didn't download needs a reload instead, and says
 * whether a deploy replaced it or the phone has no signal (docs/plans/offline.md).
 */
export default function RouteError({ variant = "page" }: RouteErrorProps) {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const isStaleBundle = isChunkLoadError(error);
  const chunk = useChunkFailureCause(isStaleBundle);
  // Re-entering the same URL gives the route a new location, which resets its error boundary.
  const retry = () =>
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: location.state,
    });

  const state = (
    <ErrorState
      title={chunk ? CHUNK_STATES[chunk].title : "Something went wrong"}
      message={
        chunk
          ? CHUNK_STATES[chunk].message
          : getErrorMessage(error, "This page hit an unexpected error.")
      }
      retryLabel={chunk ? "Reload" : "Retry"}
      onRetry={chunk ? reloadApp : retry}
      look={variant === "page" ? "card" : "inline"}
      actions={
        variant === "page" ? (
          <Button asChild variant="secondary">
            <Link to="/campaigns">Back to Home</Link>
          </Button>
        ) : null
      }
    />
  );

  if (variant === "inline") {
    return state;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-page px-4">{state}</div>
  );
}
