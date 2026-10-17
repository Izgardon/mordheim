import { Link, useLocation, useNavigate, useRouteError } from "react-router-dom";

import { ErrorState } from "@/components/ui/error-state";
import { getErrorMessage } from "@/lib/get-error-message";
import { isChunkLoadError, reloadApp } from "@/lib/reload-app";

type RouteErrorProps = {
  /** "page" covers the screen (root routes); "inline" replaces only a campaign page. */
  variant?: "page" | "inline";
};

/**
 * errorElement for the routes (IMP-11): a render error shows this instead of blanking the app.
 * Retry re-renders the route; a missing chunk after a deploy needs a reload instead.
 */
export default function RouteError({ variant = "page" }: RouteErrorProps) {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();
  const isStaleBundle = isChunkLoadError(error);
  // Re-entering the same URL gives the route a new location, which resets its error boundary.
  const retry = () =>
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: location.state,
    });

  const state = (
    <ErrorState
      title={isStaleBundle ? "The app was updated" : "Something went wrong"}
      message={
        isStaleBundle
          ? "Reload to get the latest version."
          : getErrorMessage(error, "This page hit an unexpected error.")
      }
      retryLabel={isStaleBundle ? "Reload" : "Retry"}
      onRetry={isStaleBundle ? reloadApp : retry}
      actions={
        variant === "page" ? (
          <Link to="/campaigns" className="text-xs text-muted-foreground underline">
            Back to campaigns
          </Link>
        ) : null
      }
    />
  );

  if (variant === "inline") {
    return state;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">{state}</div>
  );
}
