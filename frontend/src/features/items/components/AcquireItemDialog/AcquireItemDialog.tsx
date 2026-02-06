import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// components
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import {
  Dialog,
  DialogTitle,
  DialogTrigger,
  SimpleDialogContent,
} from "@components/dialog";
import { ExitIcon } from "@components/exit-icon";
import { Label } from "@components/label";
import { Tooltip } from "@components/tooltip";
import { UnitSelectionSection, type UnitTypeOption } from "@components/unit-selection-section";
import PriceSection from "./PriceSection";
import RaritySection from "./RaritySection";

// assets
import buyIcon from "@/assets/components/buy.webp";
import basicBar from "@/assets/containers/basic_bar.webp";
import helpIcon from "@/assets/components/help.webp";

// utils
import { cn } from "@/lib/utils";

// stores
import { useAppStore } from "@/stores/app-store";

// api
import { addWarbandItem, updateWarbandHero } from "@/features/warbands/api/warbands-api";

// types
import type { Item } from "../../types/item-types";

type AcquireItemDialogProps = {
  item: Item;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetUnitType?: UnitTypeOption;
  presetUnitId?: number | string;
};

export default function AcquireItemDialog({
  item,
  trigger,
  open: openProp,
  onOpenChange,
  presetUnitType,
  presetUnitId,
}: AcquireItemDialogProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitTypeOption | "">("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuying, setIsBuying] = useState(true);
  const [error, setError] = useState("");
  const [itemReason, setItemReason] = useState("");
  const [modifierEnabled, setModifierEnabled] = useState(false);
  const [rarityModifier, setRarityModifier] = useState(0);
  const [modifierReason, setModifierReason] = useState("");
  const [rarityRollTotal, setRarityRollTotal] = useState<number | null>(null);
  const [isUnitSelectionCollapsed, setIsUnitSelectionCollapsed] = useState(false);
  const [isRarityCollapsed, setIsRarityCollapsed] = useState(true);
  const [isPriceCollapsed, setIsPriceCollapsed] = useState(true);
  const [isReasonCollapsed, setIsReasonCollapsed] = useState(true);
  const { warband } = useAppStore();

  const unitTypes: UnitTypeOption[] = ["heroes", "stash"];
  const isControlled = openProp !== undefined;
  const resolvedSelectOpen = isControlled ? openProp : selectOpen;
  const resolvedUnitType = (selectedUnitType || presetUnitType || "") as UnitTypeOption | "";
  const resolvedUnitId =
    selectedUnitId || (presetUnitId !== undefined && presetUnitId !== null
      ? String(presetUnitId)
      : "");
  const setResolvedSelectOpen = (nextOpen: boolean) => {
    if (!isControlled) {
      setSelectOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  useEffect(() => {
    if (resolvedSelectOpen && unitTypes.length > 0 && !selectedUnitType && !presetUnitType) {
      setSelectedUnitType(unitTypes[0]);
    }
  }, [resolvedSelectOpen, selectedUnitType, unitTypes, presetUnitType]);

  useEffect(() => {
    if (!resolvedSelectOpen) {
      return;
    }
    if (presetUnitType) {
      setSelectedUnitType(presetUnitType);
    }
    if (presetUnitId !== undefined && presetUnitId !== null) {
      setSelectedUnitId(String(presetUnitId));
    }
  }, [resolvedSelectOpen, presetUnitType, presetUnitId]);

  const handleSelectOpenChange = (nextOpen: boolean) => {
    setResolvedSelectOpen(nextOpen);
    if (!nextOpen) {
      setSelectedUnitType("");
      setSelectedUnitId("");
      setError("");
      setItemReason("");
      setIsBuying(true);
      setModifierEnabled(false);
      setRarityModifier(0);
      setModifierReason("");
      setRarityRollTotal(null);
      setIsUnitSelectionCollapsed(false);
      setIsRarityCollapsed(true);
      setIsPriceCollapsed(true);
      setIsReasonCollapsed(true);
    }
  };

  const handleModifierEnabledChange = (nextEnabled: boolean) => {
    setModifierEnabled(nextEnabled);
    if (!nextEnabled) {
      setRarityModifier(0);
      setModifierReason("");
    }
  };

  const acquireLabel =
    item.type === "Weapon"
      ? `Acquire ${item.subtype?.toLowerCase() || ""} weapon`.replace("  ", " ")
      : item.type === "Animal" && item.subtype === "Attack"
        ? "Acquire attack animal"
        : `Acquire ${item.subtype?.toLowerCase() || "item"}`;

  const triggerNode =
    trigger === undefined ? (
      <Tooltip
        trigger={
          <button
            type="button"
            aria-label={acquireLabel}
            className="icon-button h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
          >
            <img src={buyIcon} alt="" className="h-full w-full object-contain" />
          </button>
        }
        content={acquireLabel}
      />
    ) : trigger === null ? null : (
      <span
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            (event.currentTarget as HTMLElement).click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        {trigger}
      </span>
    );

  const units = useMemo(() => {
    if (!warband || !resolvedUnitType) {
      return [];
    }
    if (resolvedUnitType === "heroes") {
      return warband.heroes ?? [];
    }
    return [];
  }, [resolvedUnitType, warband]);

  const selectedUnitLabel = useMemo(() => {
    if (!resolvedUnitType) {
      return "";
    }
    if (resolvedUnitType === "stash") {
      return "Warband Stash";
    }
    const heroId = Number(resolvedUnitId);
    const hero = units.find((unit) => unit.id === heroId);
    return hero?.name ?? "Unnamed";
  }, [resolvedUnitId, resolvedUnitType, units]);

  const isCommonRarity = item.rarity === 2;
  const rarityLabel = isCommonRarity ? "Common" : String(item.rarity);
  const hasVariableCost = Boolean(item.variable && item.variable.trim());
  const reasonSummary = itemReason.trim() ? itemReason.trim() : "No reason given";
  const raritySummaryNode = <SummaryPill>{rarityLabel}</SummaryPill>;
  const priceSummaryNode = (
    <SummaryPill>
      {item.cost}
      {hasVariableCost ? <span className="text-muted-foreground"> + {item.variable}</span> : null}
    </SummaryPill>
  );
  const reasonSummaryNode = (
    <SummaryPill className="max-w-[360px]" textClassName="truncate">
      {reasonSummary}
    </SummaryPill>
  );

  const canProceed =
    Boolean(resolvedUnitType) &&
    (resolvedUnitType === "stash" || Boolean(resolvedUnitId));
  const hasSelection = canProceed;
  const previousSelectionRef = useRef(false);

  useEffect(() => {
    if (!hasSelection) {
      setIsUnitSelectionCollapsed(false);
      setIsRarityCollapsed(true);
      setIsPriceCollapsed(true);
      setIsReasonCollapsed(true);
      previousSelectionRef.current = false;
      return;
    }

    const justSelected = !previousSelectionRef.current && hasSelection;
    if (justSelected) {
      setIsUnitSelectionCollapsed(true);
      setIsRarityCollapsed(true);
      setIsPriceCollapsed(true);
      setIsReasonCollapsed(true);
      requestAnimationFrame(() => {
        if (isBuying) {
          if (!isCommonRarity) {
            setIsRarityCollapsed(false);
          } else {
            setIsPriceCollapsed(false);
          }
        } else {
          setIsReasonCollapsed(false);
        }
      });
    }
    previousSelectionRef.current = hasSelection;
  }, [hasSelection, isBuying, isCommonRarity]);

  const handleAcquire = async () => {
    if (!warband || !resolvedUnitType || !canProceed) {
      return;
    }
    const trimmedReason = itemReason.trim();
    const isAcquired = !isBuying;
    const reasonText = isAcquired ? trimmedReason || "No reason given" : trimmedReason;
    const shouldIncludeReason = isAcquired;
    if (resolvedUnitType === "stash") {
      setIsSubmitting(true);
      setError("");
      try {
        await addWarbandItem(
          warband.id,
          item.id,
          shouldIncludeReason ? reasonText : undefined,
          isAcquired ? "acquired" : undefined
        );
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

    const heroId = Number(resolvedUnitId);
    const hero = units.find((unit) => unit.id === heroId);
    if (!hero) {
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
        if (shouldIncludeReason) {
          payload.item_reason = reasonText;
          payload.item_action = "acquired";
        }
        await updateWarbandHero(warband.id, heroId, payload as any);
      }
      handleSelectOpenChange(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Unable to acquire item");
      } else {
        setError("Unable to acquire item");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={resolvedSelectOpen} onOpenChange={handleSelectOpenChange}>
      {triggerNode !== null ? (
        <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      ) : null}
      <SimpleDialogContent className="max-w-[720px]">
        <DialogTitle className="sr-only">Acquire item</DialogTitle>
        <button
          type="button"
          onClick={() => handleSelectOpenChange(false)}
          className="icon-button absolute right-2 top-2 transition-[filter] hover:brightness-125"
          aria-label="Close"
        >
          <ExitIcon className="h-6 w-6" />
        </button>
        <div className="space-y-6">
          {isUnitSelectionCollapsed && hasSelection ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                <span className="text-muted-foreground">Sending to</span>
                <span>{selectedUnitLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsUnitSelectionCollapsed(false)}
                className="icon-button h-7 w-7 transition-[filter] hover:brightness-125"
                aria-label="Expand unit selection"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {hasSelection ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    <span className="text-muted-foreground">Sending to</span>
                    <span>{selectedUnitLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUnitSelectionCollapsed(true)}
                    className="icon-button h-7 w-7 transition-[filter] hover:brightness-125"
                    aria-label="Collapse unit selection"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <UnitSelectionSection
                title={
                  <>
                    Acquiring:{" "}
                    <Tooltip
                      trigger={
                        <span className="cursor-help font-medium text-foreground underline decoration-dotted underline-offset-2">
                          {item.name}
                        </span>
                      }
                      content={
                        <div className="space-y-2 not-italic">
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-xs uppercase tracking-widest text-muted-foreground">
                            {item.type}{item.subtype ? ` - ${item.subtype}` : ""}
                          </p>
                          {item.description && (
                            <p className="text-sm">{item.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {item.cost != null && <span>Cost: {item.cost} gc</span>}
                            {item.rarity != null && <span>Rarity: {item.rarity}</span>}
                            {item.variable && <span>Variable: {item.variable}</span>}
                            {item.strength && <span>Strength: {item.strength}</span>}
                            {item.range && <span>Range: {item.range}</span>}
                            {item.save && <span>Save: {item.save}</span>}
                          </div>
                        </div>
                      }
                      maxWidth={360}
                    />
                  </>
                }
                unitTypes={unitTypes}
                selectedUnitType={resolvedUnitType}
                selectedUnitId={resolvedUnitId}
                onUnitTypeChange={(value) => {
                  setSelectedUnitType(value);
                  setSelectedUnitId("");
                }}
                onUnitIdChange={setSelectedUnitId}
                units={units}
                error={error}
              />
            </div>
          )}
          {isUnitSelectionCollapsed && error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Checkbox
                checked={isBuying}
                onChange={(event) => setIsBuying(event.target.checked)}
              />
              Buying Item
            </label>
            <Tooltip
              trigger={
                <button
                  type="button"
                  className="icon-button h-7 w-7 transition-[filter] hover:brightness-125"
                  aria-label="Buying item help"
                >
                  <img src={helpIcon} alt="" className="h-6 w-6" />
                </button>
              }
              content="Toggle off to give the item without paying."
              className="inline-flex"
            />
          </div>
          <div className="mx-auto w-4/5 border-t border-border/40" />
          {isBuying ? (
            <div className="space-y-6">
              {isCommonRarity ? (
                <RaritySection
                  rarity={item.rarity}
                  modifierEnabled={modifierEnabled}
                  onModifierEnabledChange={handleModifierEnabledChange}
                  rarityModifier={rarityModifier}
                  onRarityModifierChange={setRarityModifier}
                  modifierReason={modifierReason}
                  onModifierReasonChange={setModifierReason}
                  rarityRollTotal={rarityRollTotal}
                  onRarityRollTotalChange={setRarityRollTotal}
                />
              ) : (
                <CollapsibleSection
                  title="Rarity"
                  summary={raritySummaryNode}
                  collapsed={isRarityCollapsed}
                  onToggle={() => setIsRarityCollapsed((prev) => !prev)}
                  disabled={!hasSelection}
                >
                  <RaritySection
                    rarity={item.rarity}
                    modifierEnabled={modifierEnabled}
                    onModifierEnabledChange={handleModifierEnabledChange}
                    rarityModifier={rarityModifier}
                    onRarityModifierChange={setRarityModifier}
                    modifierReason={modifierReason}
                    onModifierReasonChange={setModifierReason}
                    rarityRollTotal={rarityRollTotal}
                    onRarityRollTotalChange={setRarityRollTotal}
                  />
                </CollapsibleSection>
              )}
              <div className="mx-auto w-4/5 border-t border-border/40" />
              <CollapsibleSection
                title="Price"
                summary={priceSummaryNode}
                collapsed={isPriceCollapsed}
                onToggle={() => setIsPriceCollapsed((prev) => !prev)}
                disabled={!hasSelection}
              >
                <PriceSection cost={item.cost} variable={item.variable} />
              </CollapsibleSection>
            </div>
          ) : (
            <CollapsibleSection
              title="Reason"
              summary={reasonSummaryNode}
              collapsed={isReasonCollapsed}
              onToggle={() => setIsReasonCollapsed((prev) => !prev)}
              disabled={!hasSelection}
            >
              <div className="rounded-2xl border border-border/50 bg-background/60 p-4 shadow-[0_12px_24px_rgba(5,20,24,0.12)]">
                <Label>Reason (optional)</Label>
                <textarea
                  value={itemReason}
                  onChange={(event) => setItemReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-[6px] border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] placeholder:text-muted-foreground/70 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_10px_20px_rgba(12,7,3,0.35),inset_0_0_0_2px_hsl(var(--ring)_/_0.65)]"
                  style={{
                    backgroundImage: `url(${basicBar})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            </CollapsibleSection>
          )}
          <div className="flex justify-end">
            <Button onClick={handleAcquire} disabled={!canProceed || isSubmitting}>
              {isSubmitting ? (isBuying ? "Buying..." : "Giving...") : isBuying ? "Buy" : "Give"}
            </Button>
          </div>
        </div>
      </SimpleDialogContent>
    </Dialog>
  );
}

type SummaryPillProps = {
  children: ReactNode;
  className?: string;
  textClassName?: string;
};

function SummaryPill({ children, className, textClassName }: SummaryPillProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center rounded-2xl border border-border/60 bg-background/80 px-4 py-2 shadow-[0_8px_18px_rgba(5,20,24,0.18)]",
        className
      )}
    >
      <span className={cn("text-sm font-semibold text-foreground", textClassName)}>
        {children}
      </span>
    </div>
  );
}

type CollapsibleSectionProps = {
  title: string;
  summary?: ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  summary,
  collapsed,
  onToggle,
  disabled,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="space-y-3">
      <div className={cn("flex items-center justify-between gap-3", disabled && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{title}</span>
          {collapsed && summary ? summary : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            "icon-button h-7 w-7 transition-[filter] hover:brightness-125",
            disabled && "cursor-not-allowed opacity-60"
          )}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              collapsed ? "" : "rotate-180"
            )}
          />
        </button>
      </div>
      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          collapsed ? "max-h-0 opacity-0" : "max-h-[1200px] opacity-100"
        )}
      >
        <div className={cn("pt-1", collapsed && "pointer-events-none")}>{children}</div>
      </div>
    </div>
  );
}
