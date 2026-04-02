import { useEffect, useMemo, useState } from "react";
import type { ClipboardEvent, FocusEvent, MouseEvent } from "react";
import { Check, Pencil, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import "@/features/warbands/styles/warband.css";

import type { StatKey, UnitOverride, UnitSingleUseItem, UnitStats } from "../prebattle/prebattle-types";
import { DEFAULT_STATS, STAT_FIELDS } from "../prebattle/prebattle-types";
import { parseSpreadsheetValues } from "./battle-stat-inputs";

type BattleUnitStatsAndItemsProps = {
  unitKey: string;
  baseStats: UnitStats;
  override?: UnitOverride;
  notes?: string;
  editable: boolean;
  isEditing: boolean;
  onToggleEditing: () => void;
  onUpdateStat: (key: StatKey, value: string) => void;
  onUpdateNotes?: (notes: string) => void;
  onResetOverride: () => void;
  onApplyStatChanges?: () => void;
  isApplyingStatChanges?: boolean;
  singleUseItems: UnitSingleUseItem[];
  canUseItems: boolean;
  onUseItem: (item: UnitSingleUseItem) => void;
  getUsedItemCount: (itemId: number) => number;
  activeItemActionKey: string | null;
  showItemSection?: boolean;
  constrainStatsToHalfWidth?: boolean;
};

export default function BattleUnitStatsAndItems({
  unitKey,
  baseStats,
  override,
  notes = "",
  editable,
  isEditing,
  onToggleEditing,
  onUpdateStat,
  onUpdateNotes,
  onResetOverride,
  onApplyStatChanges,
  isApplyingStatChanges,
  singleUseItems,
  canUseItems,
  onUseItem,
  getUsedItemCount,
  activeItemActionKey,
  showItemSection = true,
  constrainStatsToHalfWidth = false,
}: BattleUnitStatsAndItemsProps) {
  const hasOverride = Boolean(override && Object.keys(override.stats).length > 0);
  const trimmedNotes = notes.trim();
  const hasSingleUseItems = showItemSection && singleUseItems.length > 0;
  const showApplyButton = typeof onApplyStatChanges === "function";
  const displayedStats = useMemo<UnitStats>(
    () =>
      Object.fromEntries(
        STAT_FIELDS.map((stat) => [stat.key, override?.stats[stat.key] ?? baseStats[stat.key] ?? DEFAULT_STATS[stat.key]])
      ) as UnitStats,
    [baseStats, override?.stats]
  );
  const resolvedStatValues = useMemo(
    () =>
      Object.fromEntries(
        STAT_FIELDS.map((stat) => [
          stat.key,
          String((override?.stats[stat.key] ?? baseStats[stat.key]) ?? ""),
        ])
      ) as Record<StatKey, string>,
    [baseStats, override?.stats]
  );
  const [draftStatValues, setDraftStatValues] = useState<Record<StatKey, string>>(resolvedStatValues);

  useEffect(() => {
    if (!isEditing) {
      setDraftStatValues(resolvedStatValues);
    }
  }, [isEditing, resolvedStatValues]);

  useEffect(() => {
    setDraftStatValues(resolvedStatValues);
  }, [unitKey, resolvedStatValues]);

  const handleSelectAll = (
    event: FocusEvent<HTMLInputElement> | MouseEvent<HTMLInputElement>
  ) => {
    event.currentTarget.select();
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
    startFieldIndex: number
  ) => {
    const pastedValues = parseSpreadsheetValues(event.clipboardData.getData("text"));
    if (pastedValues.length <= 1) {
      return;
    }

    event.preventDefault();

    const nextDraftValues = { ...draftStatValues };
    pastedValues.forEach((value, offset) => {
      const targetField = STAT_FIELDS[startFieldIndex + offset];
      if (!targetField) {
        return;
      }
      nextDraftValues[targetField.key] = value;
      onUpdateStat(targetField.key, value);
    });
    setDraftStatValues(nextDraftValues);
  };

  return (
    <div className={`mt-2 grid gap-2 ${hasSingleUseItems ? "lg:grid-cols-2" : ""}`}>
      <section
        className={`battle-inline-panel rounded-md p-2 ${
          constrainStatsToHalfWidth
            ? hasSingleUseItems
              ? "w-full"
              : "w-full lg:max-w-[50%]"
            : ""
        }`}
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">Stats</p>
          <div className="flex items-center gap-2">
            {hasOverride ? (
              <span className="text-[0.55rem] uppercase tracking-[0.16em] text-amber-300">
                Temp
              </span>
            ) : null}
            {editable ? (
              <button
                type="button"
                aria-label={isEditing ? "Close stat editing" : "Edit stats"}
                className="battle-toolbar-button icon-button flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:text-foreground"
                onClick={onToggleEditing}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <UnitStatsTable
          stats={displayedStats}
          variant="summary"
          wrapperClassName="w-full max-w-none p-0"
        />

        {!isEditing && trimmedNotes ? (
          <div className="mt-2 border-t border-border/20 pt-2">
            <p className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
              Notes
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{trimmedNotes}</p>
          </div>
        ) : null}

        {editable && isEditing ? (
          <div className="mt-2 space-y-2 border-t border-border/20 pt-2">
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
              {STAT_FIELDS.map((stat, statIndex) => (
                <div key={`edit-${unitKey}-${stat.key}`} className="space-y-1">
                  <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                    {stat.label}
                  </label>
                  <Input
                    type={stat.input}
                    min={stat.input === "number" ? 0 : undefined}
                    max={stat.input === "number" ? 10 : undefined}
                    maxLength={stat.input === "text" ? 20 : undefined}
                    value={draftStatValues[stat.key]}
                    onFocus={handleSelectAll}
                    onClick={handleSelectAll}
                    onPaste={(event) => handlePaste(event, statIndex)}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setDraftStatValues((prev) => ({
                        ...prev,
                        [stat.key]: nextValue,
                      }));
                      onUpdateStat(stat.key, nextValue);
                    }}
                    className="h-8 px-1 text-center text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-[0.5rem] uppercase tracking-[0.12em] text-muted-foreground">
                Notes
              </label>
              <Input
                value={notes}
                onChange={(event) => onUpdateNotes?.(event.target.value)}
                placeholder="Unit notes"
                maxLength={500}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              {showApplyButton ? (
                <button
                  type="button"
                  className="battle-toolbar-button icon-button flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onApplyStatChanges}
                  disabled={Boolean(isApplyingStatChanges)}
                  aria-label={isApplyingStatChanges ? "Applying stat changes" : "Apply stat changes"}
                  title={isApplyingStatChanges ? "Applying..." : "Apply"}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                className="battle-toolbar-button icon-button flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:text-foreground"
                onClick={() => {
                  setDraftStatValues(
                    Object.fromEntries(
                      STAT_FIELDS.map((stat) => [stat.key, String(baseStats[stat.key] ?? "")])
                    ) as Record<StatKey, string>
                  );
                  onResetOverride();
                }}
                aria-label="Reset temporary stat edits"
                title="Reset temporary stat edits"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {hasSingleUseItems ? (
        <section className="battle-inline-panel rounded-md p-2">
          <p className="mb-1.5 text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground">
            Single-use Items
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {singleUseItems.map((item) => {
              const usedCount = getUsedItemCount(item.id);
              const exhausted = usedCount >= item.quantity;
              const actionKey = `${unitKey}:${item.id}`;
              const isUsing = activeItemActionKey === actionKey;
              return (
                <div
                  key={`${unitKey}-item-${item.id}`}
                  className="battle-metric-box flex items-center justify-between gap-2 rounded px-2 py-1.5"
                >
                  <div className="min-w-0">
                    {item.description ? (
                      <Tooltip
                        trigger={
                          <p className="cursor-help truncate text-xs font-semibold text-foreground underline decoration-dotted underline-offset-2">
                            {item.name}
                          </p>
                        }
                        content={item.description}
                        maxWidth={280}
                      />
                    ) : (
                      <p className="truncate text-xs font-semibold text-foreground">{item.name}</p>
                    )}
                    <p className="text-[0.58rem] text-muted-foreground">
                      {usedCount}/{item.quantity} used
                    </p>
                  </div>
                  {canUseItems ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onUseItem(item)}
                      disabled={exhausted || isUsing}
                    >
                      {isUsing ? "Using..." : "Use"}
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
