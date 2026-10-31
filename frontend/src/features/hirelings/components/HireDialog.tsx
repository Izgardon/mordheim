import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { useResourceCreate } from "@/features/warbands/api/economy-queries";
import { hireWarbandHireling } from "@/features/warbands/api/warbands-hirelings";
import type { Warband, WarbandHero } from "@/features/warbands/types/warband-types";
import { toastServerWarnings } from "@/features/warbands/utils/server-warnings";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { feeOf, formatFee } from "../fees";
import type { HirelingCatalogueConfig } from "../hireling-catalogue-kinds";
import type { HirelingProfile } from "../types/hireling-catalogue-types";
import FeePayment from "./fees/FeePayment";
import HireTerms from "./fees/HireTerms";
import { paymentGold, paymentLines, paymentOf, type Payment } from "./fees/fee-payment";

type HireDialogProps = {
  config: HirelingCatalogueConfig;
  campaignId: number;
  warband: Pick<Warband, "id" | "name" | "resources" | "hero_count" | "max_heroes">;
  /** The warband's heroes, for letting one go when he takes a hero's place. */
  heroes: WarbandHero[];
  /** The entry being hired; null when closed. */
  entry: HirelingProfile | null;
  onClose: () => void;
};

/**
 * Hire from the reference (`hirelings/hire/`): the server copies the entry onto your warband
 * (profile, kit, both fees, a dramatis persona's terms) and charges what you pay. Every part of the
 * fee is prefilled and editable (the fees step): the gold, with Roll for dice, and each resource
 * line from one of your resources. A fee in his rules shows them; one who takes a hero's place
 * offers to let a hero go at the cap. A name is optional; the sheet reloads with him on it.
 */
export default function HireDialog(props: HireDialogProps) {
  const { config, campaignId, warband, entry, onClose } = props;
  const queryClient = useQueryClient();
  const addCounter = useResourceCreate(warband.id);
  const [name, setName] = useState("");
  const [payment, setPayment] = useState<Payment>(() => paymentOf(entry?.hire_fee));
  const [dismissHeroId, setDismissHeroId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const counters = warband.resources ?? [];
  useEffect(() => {
    setPayment(paymentOf(entry?.hire_fee));
    setDismissHeroId(null);
  }, [entry]);

  const hire = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const answer = await hireWarbandHireling(warband.id, {
        source: config.source,
        id: entry.id,
        ...(name.trim() ? { name: name.trim() } : {}),
        price: paymentGold(payment),
        dice_roll: payment.roll,
        resources: paymentLines(payment, counters),
        dismiss_hero_id: dismissHeroId,
      });
      toastServerWarnings(answer.warnings);
      toast.success(`${answer.name?.trim() || entry.name} joins ${warband.name}.`);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.campaign.warbandSheet(campaignId, warband.id),
      });
      setName("");
      onClose();
    } catch (error) {
      toast.error("Couldn't hire.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={entry !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      kicker={`Hire for ${warband.name}`}
      title={entry?.name ?? config.labels.singular}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="min-h-12" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-12" onClick={() => void hire()} disabled={saving}>
            {saving ? "Hiring…" : `Hire for ${paymentGold(payment)} gc`}
          </Button>
        </div>
      }
    >
      {entry ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-text2">
            Hire fee {formatFee(entry.hire_fee)}, upkeep {formatFee(entry.upkeep_fee)}.
          </p>
          <HireTerms
            kind={config.kind}
            campaignId={campaignId}
            entryId={entry.id}
            fee={entry.hire_fee}
            heroes={props.heroes}
            heroCount={warband.hero_count ?? props.heroes.length}
            maxHeroes={warband.max_heroes ?? null}
            dismissHeroId={dismissHeroId}
            onDismissHero={setDismissHeroId}
          />
          {feeOf(entry.hire_fee).kind === "none" ? null : (
            <FeePayment
              fee={entry.hire_fee}
              payment={payment}
              onChange={setPayment}
              counters={counters}
              onAddCounter={(resource) => addCounter.mutateAsync(resource).catch(() => undefined)}
              idPrefix="hire"
            />
          )}
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Name (optional)
            <Input
              value={name}
              maxLength={120}
              placeholder={entry.name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </ModalSheet>
  );
}
