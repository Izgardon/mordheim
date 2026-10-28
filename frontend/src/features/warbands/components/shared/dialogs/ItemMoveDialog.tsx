import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Button } from "@components/button";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { UnitSelectionSection, type UnitTypeOption } from "@components/unit-selection-section";
import CostPicker from "./CostPicker";
import { ANY_COST, pickedCost } from "../../../utils/stash-costs";

import type {
  WarbandHero,
  WarbandHireling,
  HenchmenGroup,
  StashCost,
} from "@/features/warbands/types/warband-types";

type UnitsByType = Partial<
  Record<UnitTypeOption, (WarbandHero | WarbandHireling | HenchmenGroup)[]>
>;

type ItemMoveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  maxQuantity: number;
  /** The stash's copies by cost (BUG-117): with several, the player picks which to move. */
  costs?: StashCost[];
  unitTypes: UnitTypeOption[];
  units: UnitsByType;
  defaultUnitType?: UnitTypeOption | "";
  disableUnitTypeSelect?: boolean;
  description?: string;
  errorMessage?: string;
  /** `cost` only when the player picked copies of one cost. */
  onConfirm: (payload: {
    quantity: number;
    unitType: UnitTypeOption | "";
    unitId: string;
    cost?: number | null;
  }) => Promise<void> | void;
};

export default function ItemMoveDialog({
  open,
  onOpenChange,
  itemName,
  maxQuantity,
  costs,
  unitTypes,
  units,
  defaultUnitType = "",
  disableUnitTypeSelect = false,
  description = "Choose where to move this item",
  errorMessage = "Failed to move item",
  onConfirm,
}: ItemMoveDialogProps) {
  const [selectedUnitType, setSelectedUnitType] = useState<UnitTypeOption | "">(defaultUnitType);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [costChoice, setCostChoice] = useState(ANY_COST);
  const picked = pickedCost(costs, costChoice);
  const maxCopies = picked ? Math.min(maxQuantity, picked.quantity) : maxQuantity;
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStash = selectedUnitType === "stash";
  const hasSelection = isStash || (selectedUnitType && selectedUnitId);

  const filteredUnits = useMemo(
    () => (selectedUnitType && selectedUnitType !== "stash" ? (units[selectedUnitType] ?? []) : []),
    [units, selectedUnitType]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    if (defaultUnitType) {
      setSelectedUnitType(defaultUnitType);
    }
  }, [defaultUnitType, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSelectedUnitType(defaultUnitType);
      setSelectedUnitId("");
      setQuantity("1");
      setCostChoice(ANY_COST);
      setError("");
      setIsSubmitting(false);
    }
  };

  const handleMove = async () => {
    setError("");
    setIsSubmitting(true);

    const moveQty = Math.max(1, Math.min(Number(quantity) || 1, maxCopies));

    try {
      await onConfirm({
        quantity: moveQty,
        unitType: selectedUnitType,
        unitId: selectedUnitId,
        ...(picked ? { cost: picked.cost } : {}),
      });
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || errorMessage);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Move {itemName}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {costs && costs.length > 1 ? (
          <div className="px-2">
            <CostPicker costs={costs} value={costChoice} onChange={setCostChoice} />
          </div>
        ) : null}
        {maxCopies > 1 && (
          <div className="space-y-2 px-2">
            <Label className="text-sm font-semibold text-foreground">Quantity</Label>
            <NumberInput
              min={1}
              max={maxCopies}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
        )}
        <UnitSelectionSection
          unitTypes={unitTypes}
          selectedUnitType={selectedUnitType}
          selectedUnitId={selectedUnitId}
          units={filteredUnits}
          error={error}
          disableUnitTypeSelect={disableUnitTypeSelect}
          onUnitTypeChange={(value) => {
            setSelectedUnitType(value);
            setSelectedUnitId("");
            setError("");
          }}
          onUnitIdChange={(value) => {
            setSelectedUnitId(value);
            setError("");
          }}
        />
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleMove} disabled={isSubmitting || !hasSelection}>
            {isSubmitting ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
