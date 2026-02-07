import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";

// components
import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import { CardBackground } from "@components/card-background";
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
import {
  addWarbandItem,
  createWarbandLog,
  createWarbandTrade,
  updateWarbandHero,
} from "@/features/warbands/api/warbands-api";

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
  const [searchingHeroId, setSearchingHeroId] = useState("");
  const [searcherTouched, setSearcherTouched] = useState(false);
  const [rolledHeroIds, setRolledHeroIds] = useState<Set<string>>(new Set());
  const [isUnitSelectionCollapsed, setIsUnitSelectionCollapsed] = useState(false);
  const [isRarityCollapsed, setIsRarityCollapsed] = useState(true);
  const [isPriceCollapsed, setIsPriceCollapsed] = useState(true);
  const [finalPrice, setFinalPrice] = useState(item.cost ?? 0);
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
      setSearchingHeroId("");
      setSearcherTouched(false);
      setRolledHeroIds(new Set());
      setIsUnitSelectionCollapsed(false);
      setIsRarityCollapsed(true);
      setIsPriceCollapsed(true);
      setFinalPrice(item.cost ?? 0);
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

  const heroOptions = useMemo(() => warband?.heroes ?? [], [warband]);

  const selectedUnitLabel = useMemo(() => {
    if (!resolvedUnitType) {
      return "";
    }
    if (resolvedUnitType === "stash") {
      return "Warband Stash";
    }
    const heroId = Number(resolvedUnitId);
    const hero = units.find((unit) => unit.id === heroId);
    return hero?.name ?? "";
  }, [resolvedUnitId, resolvedUnitType, units]);

  const isCommonRarity = item.rarity === 2;
  const rarityLabel = isCommonRarity ? "Common" : String(item.rarity);
  const hasVariableCost = Boolean(item.variable && item.variable.trim());
  const selectionLabel = isBuying ? "Buying for:" : "Giving to:";
  const rarityModifierValue = modifierEnabled ? rarityModifier : 0;
  const rarityTotal =
    rarityRollTotal === null ? null : rarityRollTotal + rarityModifierValue;
  const modifierText =
    rarityModifierValue >= 0
      ? `+ ${rarityModifierValue}`
      : `- ${Math.abs(rarityModifierValue)}`;
  const rarityRollSummary =
    rarityRollTotal !== null && !isCommonRarity
      ? ` → ${rarityRollTotal} ${modifierText} = ${rarityTotal}`
      : "";
  const rarityRollSuccess =
    !isCommonRarity && rarityTotal !== null
      ? rarityTotal >= item.rarity
      : null;
  const selectionSummaryNode = (
    <SummaryPill className="min-w-[200px] text-center">
      {selectedUnitLabel || " "}
    </SummaryPill>
  );
  const raritySummaryNode = (
    <SummaryPill>
      <span className="inline-flex items-center gap-2">
        <span>
          {rarityLabel}
          {rarityRollSummary}
        </span>
        {rarityRollSuccess === null ? null : rarityRollSuccess ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <X className="h-4 w-4 text-red-400" />
        )}
      </span>
    </SummaryPill>
  );
  const priceSummaryNode = (
    <SummaryPill>
      {finalPrice} gc
      {hasVariableCost ? <span className="text-muted-foreground"> {item.variable}</span> : null}
    </SummaryPill>
  );

  const canProceed =
    Boolean(resolvedUnitType) &&
    (resolvedUnitType === "stash" || Boolean(resolvedUnitId));

  useEffect(() => {
    if (!canProceed) {
      setIsUnitSelectionCollapsed(false);
      return;
    }
    setIsUnitSelectionCollapsed(true);
    if (isBuying) {
      if (!isCommonRarity) {
        setIsRarityCollapsed((prev) => (prev ? false : prev));
      }
      setIsPriceCollapsed((prev) => (prev ? false : prev));
    }
  }, [canProceed, isBuying, isCommonRarity]);

  useEffect(() => {
    if (!isBuying || isCommonRarity || searcherTouched) {
      return;
    }
    if (resolvedUnitType === "heroes" && resolvedUnitId) {
      setSearchingHeroId(resolvedUnitId);
    }
  }, [isBuying, isCommonRarity, resolvedUnitType, resolvedUnitId, searcherTouched]);

  const hasHeroRolled = Boolean(searchingHeroId && rolledHeroIds.has(searchingHeroId));

  const handleRarityRollTotalChange = (total: number) => {
    setRarityRollTotal(total);

    if (!warband || !searchingHeroId) {
      return;
    }
    if (rolledHeroIds.has(searchingHeroId)) {
      return;
    }

    const heroId = Number(searchingHeroId);
    const heroName =
      heroOptions.find((hero) => hero.id === heroId)?.name?.trim() || "Unnamed Hero";
    const rarityValue = item.rarity ?? 0;
    const rarityLabelText = rarityValue === 2 ? "Common" : String(rarityValue);
    const modifierValue = modifierEnabled ? rarityModifier : 0;
    const modifierReasonText = modifierEnabled
      ? modifierReason.trim() || "No reason given"
      : "No modifier";
    const totalWithModifier = total + modifierValue;
    const isSuccess = totalWithModifier >= rarityValue;

    void createWarbandLog(warband.id, {
      feature: "trading_action",
      entry_type: "rarity roll",
      payload: {
        hero: heroName,
        item: item.name,
        rarity: rarityLabelText,
        roll: total,
        modifier: modifierValue,
        reason: modifierReasonText,
        success: isSuccess,
      },
    }).catch((logError) => {
      console.error("Failed to log rarity roll", logError);
    });
  };

  const handleAcquire = async () => {
    if (!warband || !resolvedUnitType || !canProceed) {
      return;
    }
    const trimmedReason = itemReason.trim();
    const isAcquired = !isBuying;
    const reasonText = isAcquired ? trimmedReason || "No reason given" : trimmedReason;
    const shouldIncludeReason = isAcquired;
    const itemAction = isBuying ? "bought" : "received";

    setIsSubmitting(true);
    setError("");

    try {
      if (resolvedUnitType === "stash") {
        await addWarbandItem(
          warband.id,
          item.id,
          shouldIncludeReason ? reasonText : undefined,
          itemAction
        );
      } else {
        const heroId = Number(resolvedUnitId);
        const hero = units.find((unit) => unit.id === heroId);
        if (!hero) {
          setIsSubmitting(false);
          return;
        }
        const existingItemIds = hero.items.map((existing) => existing.id);
        if (!existingItemIds.includes(item.id)) {
          const payload: Record<string, unknown> = {
            item_ids: [...existingItemIds, item.id],
          };
          if (shouldIncludeReason) {
            payload.item_reason = reasonText;
          }
          payload.item_action = itemAction;
          await updateWarbandHero(warband.id, heroId, payload as any);
        }
      }

      if (isBuying && finalPrice > 0) {
        await createWarbandTrade(warband.id, {
          action: "Purchase",
          description: `Buying ${item.name}`,
          price: finalPrice,
        });
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
          className="icon-button absolute right-1 top-1 transition-[filter] hover:brightness-125"
          aria-label="Close"
        >
          <ExitIcon className="h-6 w-6" />
        </button>
        <div className="absolute left-1 top-1">
          <Tooltip
            trigger={
              <button
                type="button"
                className="icon-button h-7 w-7 transition-[filter] hover:brightness-125"
                aria-label="Acquire item help"
              >
                <img src={helpIcon} alt="" className="h-6 w-6" />
              </button>
            }
            content="Buying uses rarity and price checks. Turn it off to give the item directly without paying."
            className="inline-flex"
          />
        </div>
        <div className="space-y-6 pr-3">
          <p className="text-center text-lg text-muted-foreground">
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
                  {item.description && <p className="text-sm">{item.description}</p>}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.cost != null && <span>Cost: {item.cost} gc</span>}
                    {item.rarity != null && (
                      <span>Rarity: {item.rarity === 2 ? "Common" : item.rarity}</span>
                    )}
                    {item.variable && <span>Variable: {item.variable}</span>}
                    {item.strength && <span>Strength: {item.strength}</span>}
                    {item.range && <span>Range: {item.range}</span>}
                    {item.save && <span>Save: {item.save}</span>}
                  </div>
                </div>
              }
              maxWidth={360}
            />
          </p>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Checkbox
                checked={isBuying}
                onChange={(event) => setIsBuying(event.target.checked)}
              />
              Buying Item
            </label>
          </div>
          <CollapsibleSection
            title={selectionLabel}
            summary={selectionSummaryNode}
            collapsed={isUnitSelectionCollapsed}
            onToggle={() => setIsUnitSelectionCollapsed((prev) => !prev)}
          >
            <UnitSelectionSection
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
          </CollapsibleSection>
          <div className="mx-auto w-4/5 border-t border-border/40" />
          {isBuying ? (
            <div className="space-y-6">
              {isCommonRarity ? (
                <CollapsibleSection
                  title="Rarity:"
                  summary={raritySummaryNode}
                  collapsed
                  disabled
                  onToggle={() => undefined}
                >
                  {null}
                </CollapsibleSection>
              ) : (
                <CollapsibleSection
                  title="Rarity:"
                  summary={raritySummaryNode}
                  collapsed={isRarityCollapsed}
                  onToggle={() => setIsRarityCollapsed((prev) => !prev)}
                >
                  <RaritySection
                    rarity={item.rarity}
                    heroes={heroOptions}
                    searchingHeroId={searchingHeroId}
                    onSearchingHeroChange={(value) => {
                      setSearchingHeroId(value);
                      setSearcherTouched(true);
                    }}
                    rollLocked={hasHeroRolled}
                    rollDisabled={!searchingHeroId || hasHeroRolled}
                    onHeroRolled={(heroId) => {
                      if (!heroId) {
                        return;
                      }
                      setRolledHeroIds((prev) => {
                        const next = new Set(prev);
                        next.add(heroId);
                        return next;
                      });
                    }}
                    modifierEnabled={modifierEnabled}
                    onModifierEnabledChange={handleModifierEnabledChange}
                    rarityModifier={rarityModifier}
                    onRarityModifierChange={setRarityModifier}
                    modifierReason={modifierReason}
                    onModifierReasonChange={setModifierReason}
                    onRarityRollTotalChange={handleRarityRollTotalChange}
                  />
                </CollapsibleSection>
              )}
              <div className="mx-auto w-4/5 border-t border-border/40" />
              <CollapsibleSection
                title="Price:"
                summary={priceSummaryNode}
                collapsed={isPriceCollapsed}
                onToggle={() => setIsPriceCollapsed((prev) => !prev)}
              >
                <PriceSection
                  cost={item.cost ?? 0}
                  variable={item.variable}
                  finalPrice={finalPrice}
                  onFinalPriceChange={setFinalPrice}
                />
              </CollapsibleSection>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">
                <span className="text-muted-foreground">Reason:</span>
              </div>
              <div className="space-y-2">
                <input
                  value={itemReason}
                  onChange={(event) => setItemReason(event.target.value)}
                  className="w-full rounded-[6px] border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground shadow-[0_10px_20px_rgba(12,7,3,0.35)] placeholder:text-muted-foreground/70 placeholder:italic focus-visible:outline-none focus-visible:shadow-[0_10px_20px_rgba(12,7,3,0.35),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
                  placeholder="Optional reason"
                  style={{
                    backgroundImage: `url(${basicBar})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            </div>
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
        "inline-flex max-w-full items-center px-1",
        className
      )}
    >
      <span className={cn("text-sm font-semibold italic text-foreground", textClassName)}>
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
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={!collapsed}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{title}</span>
          {summary ?? null}
        </div>
        <span
          className={cn(
            "icon-button h-7 w-7 transition-[filter] hover:brightness-125",
            disabled && "opacity-60"
          )}
          aria-hidden="true"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              collapsed ? "-rotate-90" : "rotate-0"
            )}
          />
        </span>
      </button>
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
