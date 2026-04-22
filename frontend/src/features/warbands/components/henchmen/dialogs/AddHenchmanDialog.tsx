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

import type { Item } from "../../../../items/types/item-types";
import type { HenchmenGroupFormEntry } from "../../../types/warband-types";
import type { HenchmanItemChoice } from "../../../types/warband-types";
import type { HenchmenItemBreakdown } from "../utils/henchmen-cost";

type ItemAction = "buy" | "stash" | "ignore";

export type AddHenchmanResult = {
  name: string;
  cost: number;
  itemChoices: HenchmanItemChoice[];
};

type ExpandedRow = {
  item: Item;
  copyIndex: number;
  breakdownEntry: HenchmenItemBreakdown;
  rowKey: string;
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
  const [actions, setActions] = useState<Record<string, ItemAction>>({});
  const [itemCostOverrides, setItemCostOverrides] = useState<Record<string, string>>({});

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

  const getAction = (rowKey: string): ItemAction => actions[rowKey] ?? "buy";

  const baseCost = baseCostOverride !== null ? (Number(baseCostOverride) || 0) : defaultBaseCost;
  const xpCost = xpCostOverride !== null ? (Number(xpCostOverride) || 0) : defaultXpCost;

  const getRowCost = (row: ExpandedRow): number => {
    const override = itemCostOverrides[row.rowKey];
    if (override !== undefined) return Number(override) || 0;
    const raw = Number(row.item.cost ?? 0);
    return Number.isFinite(raw) ? raw : 0;
  };

  const expandedItems = useMemo((): ExpandedRow[] => {
    const rows: ExpandedRow[] = [];
    for (const entry of itemBreakdown) {
      for (let i = 0; i < entry.multiplier; i++) {
        rows.push({
          item: entry.item,
          copyIndex: i,
          breakdownEntry: entry,
          rowKey: `${entry.item.id}-${i}`,
        });
      }
    }
    return rows;
  }, [itemBreakdown]);

  const itemsCost = expandedItems.reduce((sum, row) => {
    if (getAction(row.rowKey) !== "buy") return sum;
    return sum + getRowCost(row);
  }, 0);

  const totalCost = baseCost + xpCost + itemsCost;

  const handleActionChange = (rowKey: string, action: ItemAction) => {
    setActions((prev) => ({ ...prev, [rowKey]: action }));
  };

  const handleItemCostChange = (rowKey: string, value: string) => {
    setItemCostOverrides((prev) => ({ ...prev, [rowKey]: value }));
  };

  const stashUsedById = useMemo(() => {
    const used: Record<number, number> = {};
    for (const row of expandedItems) {
      if (getAction(row.rowKey) === "stash") {
        used[row.item.id] = (used[row.item.id] ?? 0) + 1;
      }
    }
    return used;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedItems, actions]);

  const canStash = (row: ExpandedRow): boolean => {
    const available = stashQtyById[row.item.id] ?? 0;
    const alreadyUsed = stashUsedById[row.item.id] ?? 0;
    if (getAction(row.rowKey) === "stash") return available >= alreadyUsed;
    return available > alreadyUsed;
  };

  const handleConfirm = () => {
    const itemChoices: HenchmanItemChoice[] = expandedItems.map((row) => ({
      itemId: row.item.id,
      action: getAction(row.rowKey),
      cost: getRowCost(row),
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
                className={inputClassName}
                compact
                inputSize="sm"
              />
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Experience ({group.xp} XP &times; 2)</span>
              <NumberInput
                min={0}
                value={xpCostOverride ?? String(defaultXpCost)}
                onChange={(e) => setXpCostOverride(e.target.value)}
                className={inputClassName}
                compact
                inputSize="sm"
              />
            </div>
          </div>

          {expandedItems.length > 0 && (
            <div className="space-y-3 border-t border-border/50 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Items
              </span>
              <div className="space-y-3">
                {expandedItems.map((row) => (
                  <ItemRow
                    key={row.rowKey}
                    item={row.item}
                    unitCost={getRowCost(row)}
                    action={getAction(row.rowKey)}
                    canStash={canStash(row)}
                    costOverride={itemCostOverrides[row.rowKey]}
                    onActionChange={(action) => handleActionChange(row.rowKey, action)}
                    onCostChange={(value) => handleItemCostChange(row.rowKey, value)}
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
  item,
  unitCost,
  action,
  canStash,
  costOverride,
  onActionChange,
  onCostChange,
  inputClassName,
}: {
  item: Item;
  unitCost: number;
  action: ItemAction;
  canStash: boolean;
  costOverride: string | undefined;
  onActionChange: (action: ItemAction) => void;
  onCostChange: (value: string) => void;
  inputClassName: string;
}) {
  const displayCost = costOverride ?? String(unitCost);

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
      {action === "buy" ? (
        <NumberInput
          min={0}
          value={displayCost}
          onChange={(e) => onCostChange(e.target.value)}
          containerClassName="w-[4.5rem] shrink-0"
          className={inputClassName}
          compact
          inputSize="sm"
        />
      ) : (
        <span className="shrink-0 text-right text-xs text-muted-foreground">
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
