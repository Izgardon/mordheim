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

export default function CampaignsHeader({
  user,
  onCreate,
  onJoin,
}: CampaignsHeaderProps) {
  const displayName = user?.name || user?.email;
  return (
    <header className="flex flex-col gap-6">
      <div className="min-w-0 space-y-4">
        <h1 className="break-words text-base font-semibold text-foreground sm:text-lg md:text-xl">
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Track every expedition into the City of the Damned and keep a ledger of who returned.
        </p>
        <p className="text-xs italic text-muted-foreground sm:text-sm">
          "Every shard has a cost."
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <JoinCampaignDialog onJoin={onJoin} />
          <CreateCampaignDialog onCreate={onCreate} />
        </div>
      </div>
    </header>
  );
}





