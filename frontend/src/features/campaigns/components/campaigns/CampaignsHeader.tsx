// types
import type { AuthUser } from "../../../auth/types/auth-types";
import type { CampaignCreatePayload, CampaignJoinPayload } from "../../types/campaign-types";

// other
import CreateCampaignDialog from "../dialogs/CreateCampaignDialog";
import JoinCampaignDialog from "../dialogs/JoinCampaignDialog";

type CampaignsHeaderProps = {
  user: AuthUser | null;
  onCreate: (payload: CampaignCreatePayload) => Promise<void>;
  onJoin: (payload: CampaignJoinPayload) => Promise<void>;
};

/** The campaigns page's header (design E): who you are, the title, Join and Create. */
export default function CampaignsHeader({ user, onCreate, onJoin }: CampaignsHeaderProps) {
  // The display name only, never the email (SEC-13); a user without one is just welcomed back.
  const displayName = user?.name?.trim();
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="break-words text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </span>
        <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head max-[960px]:text-[30px]">
          Campaigns
        </h1>
      </div>
      <div className="flex gap-2 max-[960px]:grid max-[960px]:w-full max-[960px]:grid-cols-2">
        <JoinCampaignDialog onJoin={onJoin} className="max-[960px]:min-h-12" />
        <CreateCampaignDialog onCreate={onCreate} className="max-[960px]:min-h-12" />
      </div>
    </header>
  );
}
