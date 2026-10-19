import { useEffect, useMemo, useRef } from "react";

import { capabilityBasis, readCapabilities } from "@/features/battles/state/battle-capabilities";
import type { BattleState } from "@/features/battles/types/battle-types";

/**
 * The server's capabilities for the battle controls (start, end, cancel, close postbattle). Only
 * `state/` reads carry them, so a write or a message that moves a status on makes them stale:
 * once the page shows the battle (`onPage`, not while it is redirecting), one read for each new
 * set of statuses brings them back, joining a read already running. Null when the server sent
 * none, so the pages' own rules apply.
 */
export function useBattleCapabilities({
  battleState,
  onPage,
  joinRead,
}: {
  battleState: BattleState | null;
  onPage: boolean;
  joinRead: () => Promise<unknown>;
}) {
  const { capabilities, stale } = useMemo(
    () => (battleState ? readCapabilities(battleState) : { capabilities: null, stale: false }),
    [battleState]
  );
  const basis = battleState ? capabilityBasis(battleState) : "";
  const readForBasisRef = useRef("");
  useEffect(() => {
    if (stale && onPage && readForBasisRef.current !== basis) {
      readForBasisRef.current = basis;
      void joinRead().catch(() => undefined);
    }
  }, [basis, joinRead, onPage, stale]);
  return capabilities;
}
