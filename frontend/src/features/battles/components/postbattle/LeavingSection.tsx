import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import PostbattleSection, {
  POSTBATTLE_SECTION_LABELS,
} from "@/features/battles/components/postbattle/PostbattleSection";
import { deleteWarbandHireling } from "@/features/warbands/api/warbands-hirelings";
import { useWarbandCacheUpdate } from "@/features/warbands/api/warband-cache";
import DismissUnitDescription from "@/features/warbands/components/units/DismissUnitDescription";
import { getRefusalMessage } from "@/lib/get-error-message";

/** A hireling the server suggests should leave now (`suggested_postbattle.dismiss`). */
export type LeavingEntry = { unitKey: string; unitName: string; hirelingId: number | null };

/**
 * Who leaves after this battle: each hireling who stays for one battle, suggested to leave, never
 * dismissed on his own. Dismiss (after the confirm, which says his items go with him) removes him
 * from the warband now; finalising leaves everyone who isn't dismissed.
 */
export default function LeavingSection({
  isMobile,
  warbandId,
  entries,
}: {
  isMobile: boolean;
  warbandId: number;
  entries: LeavingEntry[];
}) {
  const updateWarbandCache = useWarbandCacheUpdate();
  const [confirming, setConfirming] = useState<LeavingEntry | null>(null);
  const [gone, setGone] = useState<string[]>([]);
  const dismiss = useMutation({
    mutationFn: (entry: LeavingEntry) => deleteWarbandHireling(warbandId, entry.hirelingId ?? 0),
    onSuccess: (_answer, entry) => {
      if (entry.hirelingId !== null) {
        updateWarbandCache(warbandId, { removedHirelingIds: [entry.hirelingId] });
      }
      setGone((current) => [...current, entry.unitKey]);
      setConfirming(null);
      toast.success(`${entry.unitName} has left the warband.`);
    },
  });

  return (
    <PostbattleSection
      section="leaving"
      isMobile={isMobile}
      className={isMobile ? "battle-mobile-section-divider" : undefined}
    >
      <p className="battle-section-title">{POSTBATTLE_SECTION_LABELS.leaving}</p>
      <div className="battle-inline-panel space-y-3 p-3">
        {entries.map((entry, index) => (
          <div
            key={entry.unitKey}
            className={`flex flex-wrap items-center justify-between gap-3 ${index > 0 ? "border-t border-border/40 pt-3" : ""}`}
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{entry.unitName}</p>
              <p className="text-xs text-muted-foreground">
                {gone.includes(entry.unitKey)
                  ? "Has left the warband."
                  : "Stays for one battle: suggested to leave now."}
              </p>
            </div>
            {gone.includes(entry.unitKey) || entry.hirelingId === null ? null : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  dismiss.reset();
                  setConfirming(entry);
                }}
              >
                Dismiss {entry.unitName}
              </Button>
            )}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Nobody is dismissed unless you choose to.</p>
      </div>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Dismiss ${confirming?.unitName ?? ""}`}
        description={
          <DismissUnitDescription verb="dismiss" name={confirming?.unitName ?? ""} when="now" />
        }
        confirmText={dismiss.isPending ? "Dismissing..." : "Dismiss"}
        isConfirming={dismiss.isPending}
        error={dismiss.error ? getRefusalMessage(dismiss.error, "Unable to dismiss.") : ""}
        onConfirm={() => confirming && dismiss.mutate(confirming)}
      />
    </PostbattleSection>
  );
}
