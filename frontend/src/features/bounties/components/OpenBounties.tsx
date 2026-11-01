import { useState } from "react";

import { Bone, SkeletonPage } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useCampaignBounties } from "../api/bounty-queries";
import { useBountyActions } from "../hooks/useBountyActions";
import type { Bounty } from "../types";
import BountyCard from "./BountyCard";
import ClaimBountyDialog from "./ClaimBountyDialog";
import PostBountyDialog from "./PostBountyDialog";

/** The panel while the bounties load: three cards of a name over a line. */
function BountyBones() {
  return (
    <SkeletonPage label="Loading the bounties" className="flex flex-col gap-2">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex flex-col gap-2 border border-border bg-surface p-3.5">
          <div className="flex justify-between">
            <Bone className="h-4 w-32" />
            <Bone className="h-4 w-12" />
          </div>
          <Bone className="h-3 w-44" />
        </div>
      ))}
    </SkeletonPage>
  );
}

/**
 * Open bounties (design E): the overview's panel beside the chronicle on the web, its Bounties
 * tab on a phone. Every open bounty with its claims; Post a bounty for a player with a warband.
 */
export default function OpenBounties({
  campaignId,
  isMobile,
  heading = true,
}: {
  campaignId: number;
  isMobile: boolean;
  /** The section's title (the phone's tab says it already). */
  heading?: boolean;
}) {
  const { user } = useAuth();
  const query = useCampaignBounties(campaignId);
  const actions = useBountyActions(campaignId);
  const [posting, setPosting] = useState(false);
  const [claiming, setClaiming] = useState<Bounty | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const claim = (bounty: Bounty) => {
    setClaiming(bounty);
    setClaimOpen(true);
  };
  const list = query.data;
  const reader = { userId: user?.id ?? null, warbandId: list?.my_warband?.id ?? null };
  const canPost = Boolean(list?.my_warband);

  const post = canPost ? (
    <button
      type="button"
      onClick={() => setPosting(true)}
      className={cn(
        "font-bold text-accent-text hover:bg-raised",
        isMobile
          ? "min-h-12 border border-dashed border-strong text-sm"
          : "min-h-[34px] border border-strong px-3 text-[13px]"
      )}
    >
      Post a bounty
    </button>
  ) : null;

  return (
    <section
      aria-labelledby={heading ? "bounties-h" : undefined}
      aria-label={heading ? undefined : "Open bounties"}
      className="flex flex-col gap-2.5"
    >
      {heading ? (
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="bounties-h" className="m-0 font-display text-xl font-semibold text-head">
            Open bounties
          </h2>
          {post}
        </div>
      ) : null}
      {query.isPending ? (
        <BountyBones />
      ) : query.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(query.error)}</p>
      ) : list && list.bounties.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list.bounties.map((bounty) => (
            <BountyCard
              key={bounty.id}
              bounty={bounty}
              reader={reader}
              actions={actions}
              onClaim={claim}
            />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-text2">
          No open bounties. Post one here, or from an enemy hero's card.
        </p>
      )}
      {heading ? null : post}
      <PostBountyDialog open={posting} onClose={() => setPosting(false)} campaignId={campaignId} />
      <ClaimBountyDialog
        bounty={claiming}
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        campaignId={campaignId}
      />
    </section>
  );
}
