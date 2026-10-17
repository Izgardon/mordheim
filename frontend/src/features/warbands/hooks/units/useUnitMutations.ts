import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";

import type { Unit, UnitKindKey, UnitPayload } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

/*
 * The roster's single-unit writes (design 0.28 §5.3). Each writes the returned unit into the
 * cached sheet. The summary is re-read only where gold or rating can change: XP counts towards
 * the rating; a level-up, a trading action or a learned skill changes neither. (Recruits are
 * queued and saved with the section's batch: useUnitSave.)
 */

type RowWrite = { summaryUnchanged: boolean };
/** What a write needs to know about its kind: the endpoints and the list it lands in. */
type KindRef<K extends UnitKindKey> = Pick<UnitKindConfig<K>, "key" | "listKey">;

/** Merges one unit, as the server returned it, into the cached sheet. */
export function useUnitRowWriter<K extends UnitKindKey>(kind: KindRef<K>, warbandId: number) {
  const updateWarbandCache = useWarbandCacheUpdate();
  return useCallback(
    (unit: Unit<K>, { summaryUnchanged }: RowWrite) =>
      updateWarbandCache(warbandId, {
        [kind.listKey]: [unit],
        ...(summaryUnchanged ? { summaryUnchanged } : {}),
      } as WarbandUpdate),
    [kind.listKey, updateWarbandCache, warbandId]
  );
}

/** XP +/-: PATCHes the kind's XP body; the rating follows XP, so the summary is re-read. */
export function useUnitXp<K extends UnitKindKey>(
  kind: KindRef<K> & Pick<UnitKindConfig<K>, "buildXpPayload">,
  warbandId: number
) {
  const writeUnit = useUnitRowWriter(kind, warbandId);
  return useMutation({
    mutationFn: ({ unit, xp }: { unit: Unit<K>; xp: number }) =>
      unitApi(kind.key).update(warbandId, unit.id, kind.buildXpPayload(unit, xp)),
    onSuccess: (updated) => writeUnit(updated, { summaryUnchanged: false }),
  });
}

/** A field change that leaves gold and rating alone (the trading action). */
export function useUnitPatch<K extends UnitKindKey>(kind: KindRef<K>, warbandId: number) {
  const writeUnit = useUnitRowWriter(kind, warbandId);
  return useMutation({
    mutationFn: ({ unitId, payload }: { unitId: number; payload: Partial<UnitPayload<K>> }) =>
      unitApi(kind.key).update(warbandId, unitId, payload),
    onSuccess: (updated) => writeUnit(updated, { summaryUnchanged: true }),
  });
}

/** Spends a level-up (PERF-27: no summary re-read). */
export function useUnitAdvance<K extends UnitKindKey>(kind: KindRef<K>, warbandId: number) {
  const writeUnit = useUnitRowWriter(kind, warbandId);
  return useMutation({
    mutationFn: ({ unitId, payload }: { unitId: number; payload: Record<string, unknown> }) =>
      unitApi(kind.key).levelUp(warbandId, unitId, payload),
    onSuccess: (updated) => {
      if (updated) writeUnit(updated, { summaryUnchanged: true });
    },
  });
}

/** The XP bar's save: resolves with the XP the server stored, after reporting the unit. */
export function useUnitXpSaver<K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  warbandId: number,
  unit: Unit<K>,
  onUpdated?: (updated: Unit<K>) => void
) {
  const { mutateAsync } = useUnitXp(kind, warbandId);
  return useCallback(
    async (xp: number) => {
      const updated = await mutateAsync({ unit, xp });
      onUpdated?.(updated);
      return Number(updated.xp ?? xp) || 0;
    },
    [mutateAsync, onUpdated, unit]
  );
}
