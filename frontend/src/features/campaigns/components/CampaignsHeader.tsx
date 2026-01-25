// components
import { Button } from "../../../components/ui/button";

// types
import type { AuthUser } from "../../auth/types/auth-types";
import type { CampaignCreatePayload, CampaignJoinPayload } from "../types/campaign-types";

// other
import CreateCampaignDialog from "./CreateCampaignDialog";
import JoinCampaignDialog from "./JoinCampaignDialog";

type CampaignsHeaderProps = {
  user: AuthUser | null;
  onCreate: (payload: CampaignCreatePayload) => Promise<void>;
  onJoin: (payload: CampaignJoinPayload) => Promise<void>;
  onSignOut: () => void;
};

export default function CampaignsHeader({
  user,
  onCreate,
  onJoin,
  onSignOut,
}: CampaignsHeaderProps) {
  const displayName = user?.name || user?.email;
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Chronicle
        </p>
        <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
          {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
        </h1>
        <p className="text-muted-foreground">
          Track every expedition into the City of the Damned and keep a ledger of who returned.
        </p>
        <p className="text-sm italic text-muted-foreground">"Every shard has a cost."</p>
        <div className="flex flex-wrap gap-3">
          <JoinCampaignDialog onJoin={onJoin} />
          <CreateCampaignDialog onCreate={onCreate} />
        </div>
      </div>
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={onSignOut}
      >
        Log out
      </Button>
    </header>
  );
}




