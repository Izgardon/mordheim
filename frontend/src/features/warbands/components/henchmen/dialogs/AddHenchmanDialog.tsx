import { useState, useEffect, useMemo } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/dialog";
import { Button } from "@components/button";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";

import { calculateHenchmenReinforceCost } from "../utils/henchmen-cost";

import type { HenchmenGroupFormEntry } from "../../../types/warband-types";
import type { HenchmanItemChoice } from "../../../types/warband-types";
import type { HenchmenItemBreakdown } from "../utils/henchmen-cost";

type ItemAction = "buy" | "stash" | "ignore";

export type AddHenchmanResult = {
  name: string;
  cost: number;
  itemChoices: HenchmanItemChoice[];
};

type AddHenchmanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: HenchmenGroupFormEntry;
  stashQtyById: Record<number, number>;
  onConfirm: (result: AddHenchmanResult) => void;
};

export default function AddHenchmanDialog({
  open,
  onOpenChange,
  group,
  stashQtyById,
  onConfirm,
}: AddHenchmanDialogProps) {
  const [name, setName] = useState("");
  const [baseCostOverride, setBaseCostOverride] = useState<string | null>(null);
  const [xpCostOverride, setXpCostOverride] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<number, ItemAction>>({});
  const [itemCostOverrides, setItemCostOverrides] = useState<Record<number, string>>({});

  const existingCount = group.henchmen.filter((h) => h.id !== 0).length;

  const { baseCost: defaultBaseCost, xpCost: defaultXpCost, itemBreakdown } = useMemo(
    () =>
      calculateHenchmenReinforceCost({
        price: group.price,
        xp: group.xp,
        items: group.items,
        henchmen: existingCount,
      }),
    [group.price, group.xp, group.items, existingCount],
  );

  useEffect(() => {
    if (!open) return;
    setName("");
    setBaseCostOverride(null);
    setXpCostOverride(null);
    setActions({});
    setItemCostOverrides({});
  }, [open]);

  const getAction = (itemId: number): ItemAction => actions[itemId] ?? "buy";

  const baseCost = baseCostOverride !== null ? (Number(baseCostOverride) || 0) : defaultBaseCost;
  const xpCost = xpCostOverride !== null ? (Number(xpCostOverride) || 0) : defaultXpCost;

  const getItemCost = (entry: HenchmenItemBreakdown): number => {
    const override = itemCostOverrides[entry.item.id];
    if (override !== undefined) return Number(override) || 0;
    return entry.cost;
  };

  const itemsCost = itemBreakdown.reduce((sum, entry) => {
    return sum + (getAction(entry.item.id) === "buy" ? getItemCost(entry) : 0);
  }, 0);

  const totalCost = baseCost + xpCost + itemsCost;

  const handleActionChange = (itemId: number, action: ItemAction) => {
    setActions((prev) => ({ ...prev, [itemId]: action }));
  };

  const handleItemCostChange = (itemId: number, value: string) => {
    setItemCostOverrides((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleConfirm = () => {
    const itemChoices: HenchmanItemChoice[] = itemBreakdown.map((entry) => ({
      itemId: entry.item.id,
      action: getAction(entry.item.id),
    }));
    onConfirm({ name: name.trim(), cost: totalCost, itemChoices });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setActions({});
    }
  };

  const groupName = group.name?.trim() || "Group";
  const inputClassName = "bg-background/70 border-border/60 text-foreground";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Reinforce {groupName}</DialogTitle>
          <DialogDescription>Cost breakdown for adding a new henchman</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Henchman name"
              className={inputClassName}
            />
          </div>

          <div className="space-y-2 border-t border-border/50 pt-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Base cost</span>
              <NumberInput
                min={0}
                value={baseCostOverride ?? String(defaultBaseCost)}
                onChange={(e) => setBaseCostOverride(e.target.value)}
                className={`${inputClassName} w-24`}
                inputSize="sm"
              />
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Experience ({group.xp} XP &times; 2)</span>
              <NumberInput
                min={0}
                value={xpCostOverride ?? String(defaultXpCost)}
                onChange={(e) => setXpCostOverride(e.target.value)}
                className={`${inputClassName} w-24`}
                inputSize="sm"
              />
            </div>
          </div>

          {itemBreakdown.length > 0 && (
            <div className="space-y-3 border-t border-border/50 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Items
              </span>
              <div className="space-y-3">
                {itemBreakdown.map((entry) => (
                  <ItemRow
                    key={entry.item.id}
                    entry={entry}
                    action={getAction(entry.item.id)}
                    stashQty={stashQtyById[entry.item.id] ?? 0}
                    costOverride={itemCostOverrides[entry.item.id]}
                    onActionChange={(action) => handleActionChange(entry.item.id, action)}
                    onCostChange={(value) => handleItemCostChange(entry.item.id, value)}
                    inputClassName={inputClassName}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/50 pt-3 text-sm font-semibold text-foreground">
            <span>Total</span>
            <span>{totalCost} gc</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Add Henchman &mdash; {totalCost} gc
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ItemRow({
  entry,
  action,
  stashQty,
  costOverride,
  onActionChange,
  onCostChange,
  inputClassName,
}: {
  entry: HenchmenItemBreakdown;
  action: ItemAction;
  stashQty: number;
  costOverride: string | undefined;
  onActionChange: (action: ItemAction) => void;
  onCostChange: (value: string) => void;
  inputClassName: string;
}) {
  const canStash = stashQty >= entry.multiplier;
  const displayCost = costOverride ?? String(entry.cost);
  const label =
    entry.multiplier > 1
      ? `${entry.item.name} x${entry.multiplier}`
      : entry.item.name;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
      {action === "buy" ? (
        <NumberInput
          min={0}
          value={displayCost}
          onChange={(e) => onCostChange(e.target.value)}
          className={`${inputClassName} w-24`}
          inputSize="sm"
        />
      ) : (
        <span className="w-24 text-right text-xs text-muted-foreground">
          {action === "stash" ? "from stash" : "skipped"}
        </span>
      )}
      <SegmentedControl
        value={action}
        onChange={onActionChange}
        options={[
          { value: "buy", label: "Buy" },
          { value: "stash", label: "Stash", disabled: !canStash },
          { value: "ignore", label: "Ignore" },
        ]}
      />
    </div>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: ItemAction;
  onChange: (value: ItemAction) => void;
  options: { value: ItemAction; label: string; disabled?: boolean }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              selected
                ? "bg-accent/20 text-accent shadow-sm"
                : option.disabled
                  ? "cursor-not-allowed text-muted-foreground/40"
                  : "cursor-pointer text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
