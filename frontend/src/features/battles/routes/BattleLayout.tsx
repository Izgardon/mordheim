import { Outlet, useLocation, useOutletContext } from "react-router-dom";

import BattleProvider from "@/features/battles/components/layout/BattleProvider";
import { phaseFromPath } from "@/features/battles/state/battle-machine";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

/**
 * `battles/:battleId/*`: `BattleProvider` loads the battle and sends each player to
 * the page for his status: the invitation and the pre-battle (`prebattle`), the battle (`active`)
 * or the Aftermath (`postbattle`, its own route). The bare battle URL only redirects. The
 * provider stays mounted as the battle moves on, so the next page reads nothing again.
 */
export default function BattleLayout() {
  const phase = phaseFromPath(useLocation().pathname);
  const context = useOutletContext<CampaignLayoutContext>();
  return (
    <BattleProvider phase={phase === "postbattle" ? null : phase}>
      <Outlet context={context} />
    </BattleProvider>
  );
}
