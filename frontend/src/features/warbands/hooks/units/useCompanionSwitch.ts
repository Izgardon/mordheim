import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";
import { switchCompanion } from "../../api/beasts-api";
import { useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { toastServerWarnings } from "../../utils/server-warnings";

import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

type KindRef<K extends UnitKindKey> = Pick<UnitKindConfig<K>, "key" | "listKey">;

export type CompanionSwitch = { unitId: number; rowId: number; on: boolean; name: string };

/**
 * Switches a mount or pet on for the unit holding it, or off (one request). The answer's unit and
 * summary (the rating moves) go straight into the cached sheet: nothing is read again. Its
 * warnings (two mounts, a group's mounts against its members, the warband's mounts) are toasts.
 */
export function useCompanionSwitch<K extends UnitKindKey>(kind: KindRef<K>, warbandId: number) {
  const updateWarbandCache = useWarbandCacheUpdate();
  return useMutation({
    mutationFn: ({ unitId, rowId, on }: CompanionSwitch) =>
      switchCompanion<K>(warbandId, kind.key, unitId, rowId, on),
    onSuccess: ({ unit, summary, warnings }) => {
      updateWarbandCache(warbandId, {
        [kind.listKey]: [unit as Unit<K>],
        summary,
      } as WarbandUpdate);
      toastServerWarnings(warnings);
    },
    onError: (error, { name, on }) => {
      toast.error(`Couldn't switch ${name} ${on ? "on" : "off"}.`, {
        description: getErrorMessage(error),
      });
    },
  });
}
