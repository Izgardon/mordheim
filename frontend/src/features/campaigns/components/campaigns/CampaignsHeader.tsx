// types
import type { AuthUser } from "../../../auth/types/auth-types";

/**
 * The Home page's header (design E): who you are and the title. Its sections (campaigns, the
 * workshop's warbands and lists) carry their own buttons.
 */
export default function CampaignsHeader({ user }: { user: AuthUser | null }) {
  // The display name only, never the email (SEC-13); a user without one is just welcomed back.
  const displayName = user?.name?.trim();
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="break-words text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </span>
        <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head max-[960px]:text-[30px]">
          Home
        </h1>
      </div>
    </header>
  );
}
