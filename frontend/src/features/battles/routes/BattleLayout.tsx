import { Outlet, useLocation, useOutletContext } from "react-router-dom";

import { SwordsScreen } from "@/components/ui/loading-screen";
import BattleProvider from "@/features/battles/components/layout/BattleProvider";
import { BattleEntranceReady, useBattleEntrance } from "@/features/battles/hooks/useBattleEntrance";
import { phaseFromPath } from "@/features/battles/state/battle-machine";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";

/**
 * `battles/:battleId/*`: `BattleProvider` loads the battle and sends each player to
 * the page for his status: the invitation and the pre-battle (`prebattle`), the battle (`active`)
 * or the Aftermath (`postbattle`, its own route). The bare battle URL only redirects. The
 * provider stays mounted as the battle moves on, so the next page reads nothing again. Going into
 * the battle screen (`active`) brings up the swords for one strike, until the screen is drawn.
 */
export default function BattleLayout() {
  const phase = phaseFromPath(useLocation().pathname);
  const context = useOutletContext<CampaignLayoutContext>();
  const entrance = useBattleEntrance(phase === "active");
  return (
    <BattleEntranceReady.Provider value={entrance.ready}>
      <BattleProvider phase={phase === "postbattle" ? null : phase}>
        <Outlet context={context} />
      </BattleProvider>
      {entrance.showing ? (
        <SwordsScreen label="Entering the battle" leaving={entrance.leaving} />
      ) : null}
    </BattleEntranceReady.Provider>
  );
}
