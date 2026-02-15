import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogTitle,
  DialogTrigger,
  DialogContent,
} from "@components/dialog";
import { Tooltip } from "@components/tooltip";
import { UnitSelectionSection, type UnitTypeOption } from "@components/unit-selection-section";
import CollapsibleSection from "./CollapsibleSection";
import SummaryPill from "./SummaryPill";
import PriceSection from "./PriceSection";
import RaritySection from "./RaritySection";

// assets
import buyIcon from "@/assets/components/buy.webp";
import basicBar from "@/assets/containers/basic_bar.webp";
import helpIcon from "@/assets/components/help.webp";

// stores
import { useAppStore } from "@/stores/app-store";

// api
import {
  addWarbandItem,
  createWarbandLog,
  createWarbandTrade,
  listWarbandHenchmenGroups,
  listWarbandTrades,
  updateWarbandHenchmenGroup,
  updateWarbandHero,
} from "@/features/warbands/api/warbands-api";
import { getSignedTradePrice } from "@/features/warbands/utils/warband-utils";

// types
import type { Item } from "../../types/item-types";
import type { HenchmenGroup } from "@/features/warbands/types/warband-types";

type AcquireItemDialogProps = {
  item: Item;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetUnitType?: UnitTypeOption;
  presetUnitId?: number | string;
  disableUnitSelection?: boolean;
  defaultUnitSectionCollapsed?: boolean;
  defaultRaritySectionCollapsed?: boolean;
  defaultPriceSectionCollapsed?: boolean;
  onAcquire?: (item: Item, unitType: UnitTypeOption, unitId: string) => void;
};

export default function AcquireItemDialog({
  item,
  trigger,
  open: openProp,
  onOpenChange,
  presetUnitType,
  presetUnitId,
  disableUnitSelection = false,
  defaultUnitSectionCollapsed,
  defaultRaritySectionCollapsed,
  defaultPriceSectionCollapsed,
  onAcquire,
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
  const [availableGold, setAvailableGold] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isGoldLoading, setIsGoldLoading] = useState(false);
  const [goldFetchError, setGoldFetchError] = useState("");
  const [goldValidationError, setGoldValidationError] = useState("");
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [isUnitSelectionCollapsed, setIsUnitSelectionCollapsed] = useState(
    defaultUnitSectionCollapsed ?? false
  );
  const [isRarityCollapsed, setIsRarityCollapsed] = useState(
    defaultRaritySectionCollapsed ?? true
  );
  const [isPriceCollapsed, setIsPriceCollapsed] = useState(
    defaultPriceSectionCollapsed ?? true
  );
  const [finalPrice, setFinalPrice] = useState(item.cost ?? 0);
  const { warband } = useAppStore();

  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>([]);

  const unitTypes: UnitTypeOption[] = ["heroes", "henchmen", "stash"];
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
    if (!resolvedSelectOpen || !warband) {
      return;
    }
    let active = true;
    listWarbandHenchmenGroups(warband.id)
      .then((data) => { if (active) setHenchmenGroups(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [resolvedSelectOpen, warband]);

  const resetSectionState = () => {
    setIsUnitSelectionCollapsed(defaultUnitSectionCollapsed ?? false);
    setIsRarityCollapsed(defaultRaritySectionCollapsed ?? true);
    setIsPriceCollapsed(defaultPriceSectionCollapsed ?? true);
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
      setAvailableGold(null);
      setQuantity(1);
      setQuantityTouched(false);
      setIsGoldLoading(false);
      setGoldFetchError("");
      setGoldValidationError("");
      setHenchmenGroups([]);
      resetSectionState();
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
    if (resolvedUnitType === "henchmen") {
      return henchmenGroups as any;
    }
    return [];
  }, [resolvedUnitType, warband, henchmenGroups]);

  const heroOptions = useMemo(() => warband?.heroes ?? [], [warband]);

  const selectedUnitLabel = useMemo(() => {
    if (!resolvedUnitType) {
      return "";
    }
    if (resolvedUnitType === "stash") {
      return "Warband Stash";
    }
    if (resolvedUnitType === "henchmen") {
      const groupId = Number(resolvedUnitId);
      const group = henchmenGroups.find((g) => g.id === groupId);
      return group?.name ?? "";
    }
    const heroId = Number(resolvedUnitId);
    const hero = units.find((unit) => unit.id === heroId);
    return hero?.name ?? "";
  }, [resolvedUnitId, resolvedUnitType, units, henchmenGroups]);

  const isCommonRarity = item.rarity === 2;
  const rarityLabel = isCommonRarity ? "Common" : String(item.rarity);
  const hasVariableCost = Boolean(item.variable && item.variable.trim());
  const totalPrice = isCommonRarity && isBuying ? finalPrice * quantity : finalPrice;
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
      {isCommonRarity && isBuying && quantity > 1
        ? `${finalPrice} × ${quantity} = ${totalPrice} gc`
        : `${totalPrice} gc`}
      {hasVariableCost ? <span className="text-muted-foreground"> {item.variable}</span> : null}
    </SummaryPill>
  );

  const canProceed =
    Boolean(resolvedUnitType) &&
    (resolvedUnitType === "stash" || Boolean(resolvedUnitId));
  const requiresGoldCheck = isBuying && totalPrice > 0;

  const goldFromResources = useMemo(() => {
    if (!warband?.resources?.length) {
      return null;
    }
    const goldResource = warband.resources.find(
      (resource) => resource.name.trim().toLowerCase() === "gold crowns"
    );
    if (!goldResource) {
      return null;
    }
    const amount = Number(goldResource.amount ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  }, [warband?.resources]);

  const resolvedGold = availableGold ?? 0;
  const isGoldBlocked =
    requiresGoldCheck &&
    (isGoldLoading ||
      Boolean(goldFetchError) ||
      availableGold === null ||
      totalPrice > resolvedGold);
  const actionDisabled = !canProceed || isSubmitting || isGoldBlocked;

  const actionDisabledReason = useMemo(() => {
    if (!actionDisabled) {
      return "";
    }
    if (!canProceed) {
      if (!resolvedUnitType) {
        return "Select who receives the item.";
      }
      if (resolvedUnitType === "heroes" && !resolvedUnitId) {
        return "Select a hero to receive the item.";
      }
      if (resolvedUnitType === "henchmen" && !resolvedUnitId) {
        return "Select a henchmen group to receive the item.";
      }
      return "Select a receiver to continue.";
    }
    if (isSubmitting) {
      return isBuying ? "Processing purchase..." : "Processing...";
    }
    if (isGoldBlocked) {
      if (isGoldLoading) {
        return "Checking gold crowns...";
      }
      if (goldFetchError) {
        return goldFetchError;
      }
      if (goldValidationError) {
        return goldValidationError;
      }
      return "Not enough gold crowns.";
    }
    return "Unable to proceed.";
  }, [
    actionDisabled,
    canProceed,
    resolvedUnitType,
    resolvedUnitId,
    isSubmitting,
    isBuying,
    isGoldBlocked,
    isGoldLoading,
    goldFetchError,
    goldValidationError,
  ]);

  useEffect(() => {
    if (!resolvedSelectOpen) {
      return;
    }
    if (!warband || !isBuying) {
      setAvailableGold(null);
      setGoldFetchError("");
      setIsGoldLoading(false);
      return;
    }
    if (goldFromResources !== null) {
      setAvailableGold(goldFromResources);
      setGoldFetchError("");
      return;
    }

    setIsGoldLoading(true);
    setGoldFetchError("");
    listWarbandTrades(warband.id)
      .then((trades) => {
        const total = trades.reduce((sum, trade) => sum + getSignedTradePrice(trade), 0);
        setAvailableGold(total);
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setGoldFetchError(errorResponse.message || "Unable to load gold crowns.");
        } else {
          setGoldFetchError("Unable to load gold crowns.");
        }
        setAvailableGold(null);
      })
      .finally(() => setIsGoldLoading(false));
  }, [resolvedSelectOpen, warband, isBuying, goldFromResources]);

  useEffect(() => {
    if (!resolvedSelectOpen) {
      return;
    }
    setQuantityTouched(false);
  }, [resolvedSelectOpen, resolvedUnitType, resolvedUnitId, item.id, isBuying, isCommonRarity]);

  useEffect(() => {
    if (!resolvedSelectOpen || !isBuying || !isCommonRarity) {
      return;
    }
    if (resolvedUnitType !== "henchmen" || !resolvedUnitId) {
      return;
    }
    if (quantityTouched) {
      return;
    }

    const groupId = Number(resolvedUnitId);
    const group = henchmenGroups.find((g) => g.id === groupId);
    if (!group) {
      return;
    }

    const henchmenCount = (group.henchmen ?? []).length;
    const itemCount = (group.items ?? []).filter((entry) => entry.id === item.id).length;

    let nextQuantity = 1;
    if (henchmenCount <= 0) {
      nextQuantity = 1;
    } else if (itemCount > henchmenCount) {
      const nextMultiple = (Math.floor(itemCount / henchmenCount) + 1) * henchmenCount;
      nextQuantity = nextMultiple - itemCount;
    } else {
      nextQuantity = henchmenCount - itemCount;
    }

    if (nextQuantity <= 0) {
      nextQuantity = 1;
    }

    setQuantity(nextQuantity);
  }, [
    resolvedSelectOpen,
    resolvedUnitType,
    resolvedUnitId,
    isBuying,
    isCommonRarity,
    henchmenGroups,
    item.id,
    quantityTouched,
  ]);

  useEffect(() => {
    if (!requiresGoldCheck) {
      setGoldValidationError("");
      return;
    }
    if (availableGold === null) {
      setGoldValidationError("");
      return;
    }
    if (totalPrice > availableGold) {
      setGoldValidationError(`Not enough gold crowns. Available: ${availableGold} gc.`);
      return;
    }
    setGoldValidationError("");
  }, [requiresGoldCheck, totalPrice, availableGold]);

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
    const modifierReasonText = modifierEnabled ? modifierReason.trim() || "No reason given" : "";
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
        ...(modifierEnabled ? { reason: modifierReasonText } : {}),
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
    if (isGoldBlocked) {
      if (!goldFetchError && !goldValidationError) {
        setGoldValidationError("Not enough gold crowns.");
      }
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const count = isCommonRarity ? quantity : 1;
      if (resolvedUnitType === "stash") {
        for (let i = 0; i < count; i++) {
          await addWarbandItem(warband.id, item.id);
        }
      } else if (resolvedUnitType === "henchmen") {
        const groupId = Number(resolvedUnitId);
        const group = henchmenGroups.find((g) => g.id === groupId);
        if (!group) {
          setIsSubmitting(false);
          return;
        }
        const existingItemIds = group.items.map((existing) => existing.id);
        await updateWarbandHenchmenGroup(warband.id, groupId, {
          item_ids: [...existingItemIds, ...Array(count).fill(item.id)],
        } as any);
      } else {
        const heroId = Number(resolvedUnitId);
        const hero = units.find((unit) => unit.id === heroId);
        if (!hero) {
          setIsSubmitting(false);
          return;
        }
        const existingItemIds = hero.items.map((existing) => existing.id);
        await updateWarbandHero(warband.id, heroId, {
          item_ids: [...existingItemIds, ...Array(count).fill(item.id)],
        } as any);
      }

      onAcquire?.(item, resolvedUnitType, resolvedUnitId);

      if (isBuying && totalPrice > 0) {
        await createWarbandTrade(warband.id, {
          action: "Bought",
          description: quantity > 1 ? `${item.name} x ${quantity}` : item.name,
          price: totalPrice,
        });
      }

      const actorName =
        resolvedUnitType === "stash"
          ? "Stash"
          : resolvedUnitType === "henchmen"
            ? henchmenGroups.find((g) => g.id === Number(resolvedUnitId))?.name?.trim() || "Unknown Group"
            : units.find((u) => u.id === Number(resolvedUnitId))?.name?.trim() || "Unknown Hero";

      await createWarbandLog(warband.id, {
        feature: "loadout",
        entry_type: resolvedUnitType === "henchmen" ? "henchmen_item" : "hero_item",
        payload: {
          hero: actorName,
          item: item.name,
          ...(isBuying && totalPrice > 0 ? { price: totalPrice } : {}),
          ...(quantity > 1 ? { quantity } : {}),
          ...(!isBuying && itemReason.trim() ? { reason: itemReason.trim() } : {}),
        },
      });

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
      <DialogContent className="max-w-[720px]">
        <DialogTitle className="sr-only">Acquire item</DialogTitle>
        <div className="absolute left-1 top-1">
          <Tooltip
            trigger={
              <button
                type="button"
                tabIndex={-1}
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
          <div className="flex flex-col items-center gap-2">
            <div
              className="inline-flex items-center rounded-full border border-border/60 bg-background/40 p-1 shadow-[0_12px_26px_rgba(12,7,3,0.45)]"
              style={{
                backgroundImage: `url(${basicBar})`,
                backgroundSize: "100% 100%",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            >
              <Button
                type="button"
                variant={isBuying ? "default" : "secondary"}
                size="sm"
                aria-pressed={isBuying}
                onClick={() => setIsBuying(true)}
                className="min-w-[120px] rounded-full px-5"
              >
                Buy item
              </Button>
              <Button
                type="button"
                variant={!isBuying ? "default" : "secondary"}
                size="sm"
                aria-pressed={!isBuying}
                onClick={() => setIsBuying(false)}
                className="min-w-[120px] rounded-full px-5"
              >
                Give item
              </Button>
            </div>
            <p className="text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground">
              {isBuying
                ? "Buying uses rarity and price checks"
                : "Giving skips price and rarity checks"}
            </p>
          </div>
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
              disableUnitTypeSelect={disableUnitSelection}
              disableUnitSelect={disableUnitSelection}
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
                  isCommon={isCommonRarity}
                  quantity={quantity}
                  onQuantityChange={(value) => {
                    setQuantity(value);
                    setQuantityTouched(true);
                  }}
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
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Spacebar") {
                      event.stopPropagation();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " " || event.key === "Spacebar") {
                      event.stopPropagation();
                    }
                  }}
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
            {actionDisabledReason ? (
              <Tooltip
                trigger={
                  <span className="inline-flex cursor-not-allowed">
                    <Button
                      onClick={handleAcquire}
                      disabled={actionDisabled}
                      className="pointer-events-none"
                    >
                      {isSubmitting ? (isBuying ? "Buying..." : "Giving...") : isBuying ? "Buy" : "Give"}
                    </Button>
                  </span>
                }
                content={actionDisabledReason}
                className="inline-flex"
              />
            ) : (
              <Button onClick={handleAcquire} disabled={actionDisabled}>
                {isSubmitting ? (isBuying ? "Buying..." : "Giving...") : isBuying ? "Buy" : "Give"}
              </Button>
            )}
          </div>
          {isBuying && (isGoldLoading || goldFetchError || goldValidationError) ? (
            <p className="text-xs text-muted-foreground">
              {isGoldLoading
                ? "Checking gold crowns..."
                : goldFetchError || goldValidationError}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
