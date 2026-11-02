import { ChipLabel } from "@/components/ui/chip";

import { useCampaignBounties } from "../api/bounty-queries";
import { bountiesOn, goldText } from "../bounty-view";

type HeroLike = { id: number };

/**
 * Bounties on a warband page's hero cards: the open bounties on each hero as a chip ("Bounty ·
 * 40 gc", in danger on your own). They are posted only from the Bounties section (William: "only
 * allow bounties to be posted from the bounties section, not from a warband").
 */
export function useHeroBounties(campaignId: number, mine: boolean) {
  const list = useCampaignBounties(campaignId).data;

  return (hero: HeroLike) => {
    const { bounties, total } = bountiesOn(list, hero.id);
    return bounties.length ? (
      <ChipLabel
        tone={mine ? "danger" : "accent"}
        title={bounties
          .map((bounty) => `${goldText(bounty.amount)} from ${bounty.posted_by.warband_name}`)
          .join(", ")}
      >
        Bounty · {goldText(total)}
      </ChipLabel>
    ) : null;
  };
}
