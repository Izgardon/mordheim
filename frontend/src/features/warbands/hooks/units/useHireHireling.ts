import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { hireWarbandHireling, type HireSource } from "../../api/warbands-hirelings";
import { useUnitRowWriter } from "./useUnitMutations";

import type { WarbandHireling } from "../../types/warband-types";

type HireInput = { source: HireSource; id: number; name?: string };

/** Where a hireling lands in the sheet (the kind config would import this hook back). */
const HIRELINGS = { key: "hireling", listKey: "hirelings" } as const;

/**
 * Hires a hired sword or dramatis persona on the server: the new hireling goes into the cached
 * sheet (gold, rating and the counts are read again: the fee and the cap changed), the ledger and
 * log are marked stale, and each of the server's warnings shows as a toast (the hire went ahead).
 */
export function useHireHireling(warbandId: number, onHired: (hireling: WarbandHireling) => void) {
  const writeUnit = useUnitRowWriter(HIRELINGS, warbandId);
  return useMutation({
    mutationFn: ({ source, id, name }: HireInput) =>
      hireWarbandHireling(warbandId, { source, id, ...(name ? { name } : {}) }),
    onSuccess: ({ warnings = [], ...hireling }) => {
      writeUnit(hireling, { summaryUnchanged: false });
      onHired(hireling);
      toast.success(`${hireling.name || hireling.unit_type || "Your hireling"} joins the warband.`);
      for (const warning of warnings) {
        toast.warning(warning.message, { id: `hire-${hireling.id}-${warning.code}` });
      }
    },
  });
}
