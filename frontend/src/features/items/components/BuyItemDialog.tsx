import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  SimpleDialogContent,
} from "@components/dialog";
import { Label } from "@components/label";
import { Tooltip } from "@components/tooltip";
import { UnitSelectionDialog, type UnitTypeOption } from "@components/unit-selection-dialog";
import DiceRoller from "@/components/dice/DiceRoller";

// assets
import buyIcon from "@/assets/components/buy.png";
import basicBar from "@/assets/containers/basic_bar.png";

// stores
import { useAppStore } from "@/stores/app-store";

// api
import { addWarbandItem, updateWarbandHero } from "@/features/warbands/api/warbands-api";

// types
import type { Item } from "../types/item-types";

type BuyItemDialogProps = {
  item: Item;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export default function BuyItemDialog({
  item,
  trigger,
  open: openProp,
  onOpenChange,
}: BuyItemDialogProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitTypeOption | "">("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [itemReason, setItemReason] = useState("");
  const { diceColor, warband } = useAppStore();

  const unitTypes: UnitTypeOption[] = ["heroes", "stash"];
  const resolvedSelectOpen = openProp ?? selectOpen;
  const setResolvedSelectOpen = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setSelectOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (resolvedSelectOpen && unitTypes.length > 0 && !selectedUnitType) {
      setSelectedUnitType(unitTypes[0]);
    }
  }, [resolvedSelectOpen, selectedUnitType, unitTypes]);

  const handleSelectOpenChange = (nextOpen: boolean) => {
    setResolvedSelectOpen(nextOpen);
    if (!nextOpen) {
      setSelectedUnitType("");
      setSelectedUnitId("");
      setError("");
      setItemReason("");
    }
  };

  const openActionDialog = () => {
    setActionOpen(true);
  };

  const triggerNode =
    trigger === undefined ? (
      <Tooltip
        trigger={
          <button
            type="button"
            aria-label="Buy item"
            className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
            onClick={openActionDialog}
          >
            <img src={buyIcon} alt="" className="h-full w-full object-contain" />
          </button>
        }
        content="Buy Item"
      />
    ) : (
      <span
        onClick={openActionDialog}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openActionDialog();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {trigger}
      </span>
    );

  const units = useMemo(() => {
    if (!warband || !selectedUnitType) {
      return [];
    }
    if (selectedUnitType === "heroes") {
      return warband.heroes ?? [];
    }
    return [];
  }, [selectedUnitType, warband]);

  const canProceed =
    Boolean(selectedUnitType) &&
    (selectedUnitType === "stash" || Boolean(selectedUnitId));

  const handleGive = async () => {
    if (!warband || !selectedUnitType || !canProceed) {
      return;
    }
    const trimmedReason = itemReason.trim();
    if (selectedUnitType === "stash") {
      setIsSubmitting(true);
      setError("");
      try {
        await addWarbandItem(warband.id, item.id, trimmedReason || undefined);
        handleSelectOpenChange(false);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message || "Unable to add item to stash");
        } else {
          setError("Unable to add item to stash");
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const heroId = Number(selectedUnitId);
    const hero = units.find((unit) => unit.id === heroId);
    if (!hero) {
      return;
    }
    if (hero.items.length >= 6) {
      setError("This hero already has 6 items.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const existingItemIds = hero.items.map((existing) => existing.id);
      if (!existingItemIds.includes(item.id)) {
        const payload: Record<string, unknown> = {
          item_ids: [...existingItemIds, item.id],
        };
        if (trimmedReason) {
          payload.item_reason = trimmedReason;
        }
        await updateWarbandHero(warband.id, heroId, payload as any);
      }
      handleSelectOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Unable to give item");
      } else {
        setError("Unable to give item");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {triggerNode}

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <SimpleDialogContent className="max-w-[380px]">
          <div className="space-y-2 text-center">
            <h2 className="text-lg font-semibold text-foreground">Add Item</h2>
            <p className="text-sm text-muted-foreground">
              Choose how you want to add this item.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setActionOpen(false);
                handleSelectOpenChange(true);
              }}
            >
              Give
            </Button>
            <Button
              onClick={() => {
                setActionOpen(false);
                setBuyOpen(true);
              }}
            >
              Buy
            </Button>
          </div>
        </SimpleDialogContent>
      </Dialog>

      <UnitSelectionDialog
        open={resolvedSelectOpen}
        onOpenChange={handleSelectOpenChange}
        trigger={null}
        title={
          <>
            Giving: <span className="font-medium text-foreground">{item.name}</span>
          </>
        }
        unitTypes={unitTypes}
        selectedUnitType={selectedUnitType}
        selectedUnitId={selectedUnitId}
        onUnitTypeChange={(value) => {
          setSelectedUnitType(value);
          setSelectedUnitId("");
        }}
        onUnitIdChange={setSelectedUnitId}
        units={units}
        error={error}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => handleSelectOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!canProceed) {
                  return;
                }
                handleSelectOpenChange(false);
                setBuyOpen(true);
              }}
              disabled={!canProceed || isSubmitting}
            >
              Buy
            </Button>
            <Button
              onClick={handleGive}
              disabled={!canProceed || isSubmitting}
            >
              {isSubmitting ? "Giving..." : "Give"}
            </Button>
          </>
        }
        extra={
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <textarea
              value={itemReason}
              onChange={(event) => setItemReason(event.target.value)}
              placeholder="Why is this item being given?"
              rows={3}
              className="w-full rounded-[6px] border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] placeholder:text-muted-foreground/70 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_10px_20px_rgba(12,7,3,0.35),inset_0_0_0_2px_hsl(var(--ring)_/_0.65)]"
              style={{
                backgroundImage: `url(${basicBar})`,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            />
            <p className="text-xs text-muted-foreground">
              Used when giving items, not when buying.
            </p>
          </div>
        }
      />

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-[750px]">
          <DialogHeader>
            <DialogTitle className="font-bold" style={{ color: "#a78f79" }}>
              BUY WARGEAR
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Fixed 2d6</h3>
                <p className="text-sm text-muted-foreground">Quick roll for standard purchases.</p>
              </div>
              <DiceRoller mode="fixed" fixedNotation="2d6" fullScreen themeColor={diceColor} />
            </section>
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Custom roll</h3>
                <p className="text-sm text-muted-foreground">Choose the dice mix you need.</p>
              </div>
              <DiceRoller mode="custom" fullScreen themeColor={diceColor} />
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
