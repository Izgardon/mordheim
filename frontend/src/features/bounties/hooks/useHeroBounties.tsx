import { useState } from "react";
import { Crosshair } from "lucide-react";

import { ChipLabel } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";

import { useCampaignBounties } from "../api/bounty-queries";
import { bountiesOn, goldText } from "../bounty-view";
import PostBountyDialog, { type BountyTarget } from "../components/PostBountyDialog";

type HeroLike = { id: number; name?: string | null; unit_type?: string | null };

/**
 * Bounties on a warband page's hero cards: the open bounties on each hero as a chip ("Bounty ·
 * 40 gc", in danger on your own), and on another warband's heroes, for a player with a warband,
 * the button that posts one (design E: the button lives on the hero's card).
 */
export function useHeroBounties(
  campaignId: number,
  warband: { id: number; name: string } | null,
  mine: boolean
) {
  const list = useCampaignBounties(campaignId).data;
  // the hero stays the target while the dialog closes, so its title doesn't change as it goes
  const [target, setTarget] = useState<BountyTarget | null>(null);
  const [open, setOpen] = useState(false);
  const canPost = Boolean(list?.my_warband) && !mine;

  const extraFor = (hero: HeroLike) => {
    const { bounties, total } = bountiesOn(list, hero.id);
    const name = hero.name || hero.unit_type || "this hero";
    return (
      <>
        {bounties.length ? (
          <ChipLabel
            tone={mine ? "danger" : "accent"}
            title={bounties
              .map((bounty) => `${goldText(bounty.amount)} from ${bounty.posted_by.warband_name}`)
              .join(", ")}
          >
            Bounty · {goldText(total)}
          </ChipLabel>
        ) : null}
        {canPost && warband ? (
          <IconButton
            aria-label={`Post a bounty on ${name}`}
            title="Post a bounty"
            className="h-9 w-9"
            onClick={() => {
              setTarget({ heroId: hero.id, name, warbandName: warband.name });
              setOpen(true);
            }}
          >
            <Crosshair aria-hidden="true" />
          </IconButton>
        ) : null}
      </>
    );
  };

  const dialog = (
    <PostBountyDialog
      open={open}
      target={target}
      onClose={() => setOpen(false)}
      campaignId={campaignId}
    />
  );
  return { extraFor, dialog };
}
