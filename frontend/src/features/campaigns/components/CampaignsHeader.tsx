import { Button } from "../../../components/ui/button";
import type { AuthUser } from "../../auth/types/auth-types";
import type { CampaignCreatePayload, CampaignJoinPayload } from "../types/campaign-types";
import CreateCampaignDialog from "./CreateCampaignDialog";
import JoinCampaignDialog from "./JoinCampaignDialog";

type CampaignsHeaderProps = {
  user: AuthUser | null;
  isReady: boolean;
  onCreate: (payload: CampaignCreatePayload) => Promise<void>;
  onJoin: (payload: CampaignJoinPayload) => Promise<void>;
  onSignOut: () => void;
};

export default function CampaignsHeader({
  user,
  isReady,
  onCreate,
  onJoin,
  onSignOut,
}: CampaignsHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          Chronicle
        </p>
        <h1 className="text-3xl font-semibold text-slate-500 md:text-4xl">
          {isReady && user
            ? `Welcome back, ${user.name || user.email}`
            : "Summoning the warband..."}
        </h1>
        <p className="text-slate-600">
          Track every expedition into the City of the Damned and keep a ledger of who returned.
        </p>
        <p className="text-sm italic text-slate-500">"Every shard has a cost."</p>
        <div className="flex flex-wrap gap-3">
          <JoinCampaignDialog onJoin={onJoin} />
          <CreateCampaignDialog onCreate={onCreate} />
        </div>
      </div>
      <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={onSignOut}>
        Log out
      </Button>
    </header>
  );
}
