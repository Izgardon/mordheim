import { Outlet, useLocation } from "react-router-dom";

import BattleProvider from "@/features/battles/components/layout/BattleProvider";
import BattleShell from "@/features/battles/components/layout/BattleShell";
import { phaseFromPath } from "@/features/battles/state/battle-machine";

/**
 * The battle pages' layout: the chrome (`BattleShell`) around `BattleProvider`, which owns the
 * battle's state and rosters and the phase redirects for whichever page the URL names. The
 * provider stays mounted as the battle moves from prebattle to active to postbattle.
 */
export default function BattleLayout() {
  const phase = phaseFromPath(useLocation().pathname);

  return (
    <BattleShell>
      {(outletContext) =>
        phase ? (
          <BattleProvider phase={phase}>
            <Outlet context={outletContext} />
          </BattleProvider>
        ) : (
          <Outlet context={outletContext} />
        )
      }
    </BattleShell>
  );
}
