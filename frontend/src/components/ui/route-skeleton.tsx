import { CardSkeleton } from "./card-skeleton";

/** Placeholder for a campaign page whose code is still loading; the shell stays on screen. */
export function RouteSkeleton() {
  return (
    <div className="px-2 py-6 md:px-0" role="status" aria-label="Loading page">
      <CardSkeleton count={4} />
    </div>
  );
}
