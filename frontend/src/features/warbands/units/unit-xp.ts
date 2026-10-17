import { unitApi } from "./unit-api";

import type { Unit, UnitKindKey } from "../types/units";
import type { UnitKindConfig } from "./unit-kind-types";

/**
 * The XP bar's save: PATCHes the kind's XP payload (today the whole unit, BUG-63), reports the
 * updated unit and resolves with the saved XP. A failure rejects; the bar has no error handling.
 */
export const createUnitXpSaver =
  <K extends UnitKindKey>(
    kind: UnitKindConfig<K>,
    warbandId: number,
    unit: Unit<K>,
    onUpdated?: (updated: Unit<K>) => void
  ) =>
  async (newXp: number): Promise<number> => {
    const updated = await unitApi(kind.key).update(
      warbandId,
      unit.id,
      kind.buildXpPayload(unit, newXp)
    );
    onUpdated?.(updated);
    return Number(updated.xp ?? newXp) || 0;
  };
