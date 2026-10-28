import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Button } from "@components/button";
import { Label } from "@components/label";
import { NumberInput } from "@components/number-input";
import { getItem } from "@/features/items/api/items-api";
import { useCatalogueEntryDetail } from "@/features/catalogue/hooks/useCatalogueEntryDetail";
import { getErrorMessage } from "@/lib/get-error-message";
import RecruitTargetPicker, {
  defaultRecruitChoice,
  groupsOfBeast,
  recruitTarget,
  type RecruitChoice,
} from "./RecruitTargetPicker";
import { useActingWarband, useShownSheet } from "../../warband/shown-warband-context";
import { useBeastRecruit } from "../../../hooks/units/useBeastRecruit";

import type { RecruitSource } from "../../../api/beasts-api";

export type RecruitRequest = {
  item: { id: number; name: string };
  /** How many copies the source holds (the most that can be recruited). */
  copies: number;
  source: RecruitSource;
};

type BeastRecruitDialogProps = RecruitRequest & {
  warbandId: number;
  onClose: () => void;
};

/**
 * Recruits a creature's copies into henchmen: join a group recruited from the same beast (found
 * through the item's beast, read once and cached) or form a new one, and how many. No gold moves.
 */
export default function BeastRecruitDialog({
  item,
  copies,
  source,
  warbandId,
  onClose,
}: BeastRecruitDialogProps) {
  const campaignId = useActingWarband()?.campaign_id ?? 0;
  const sheet = useShownSheet();
  const { entry, isLoading } = useCatalogueEntryDetail("items", campaignId, item.id, getItem);
  const beast = entry?.bestiary_entry ?? null;
  const groups = groupsOfBeast(sheet?.henchmen_groups ?? [], beast?.id);
  const [picked, setPicked] = useState<RecruitChoice | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const recruit = useBeastRecruit(warbandId);
  const choice = picked ?? defaultRecruitChoice(groups);

  const handleRecruit = async () => {
    const target = recruitTarget(choice, name);
    if (!target) return;
    const count = Math.max(1, Math.min(Number(quantity) || 1, copies));
    try {
      await recruit.mutateAsync({ source, quantity: count, target });
      onClose();
    } catch {
      // The refusal shows in the dialog (recruit.error).
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Recruit {item.name}</DialogTitle>
          <DialogDescription>
            They become henchmen. No gold changes hands: they were paid for as items.
          </DialogDescription>
        </DialogHeader>
        <RecruitTargetPicker
          groups={groups}
          value={choice}
          onChange={setPicked}
          name={name}
          onNameChange={setName}
          defaultName={beast?.name ?? item.name}
        />
        {copies > 1 ? (
          <div className="space-y-1">
            <Label>Quantity</Label>
            <NumberInput
              aria-label="Quantity"
              min={1}
              max={copies}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
        ) : null}
        {recruit.error ? (
          <p role="alert" className="text-sm text-red-400">
            {getErrorMessage(recruit.error)}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={recruit.isPending}>
            Cancel
          </Button>
          <Button onClick={() => void handleRecruit()} disabled={recruit.isPending || isLoading}>
            {recruit.isPending ? "Recruiting..." : "Recruit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
