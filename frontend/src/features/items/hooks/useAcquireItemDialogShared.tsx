import { useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import BuyItemButton from "../components/AcquireItemDialog/BuyItemButton";

import { useAppStore } from "@/stores/app-store";

import {
  addWarbandItem,
  createWarbandLog,
  createWarbandTrade,
  getWarbandHenchmenGroupDetail,
  getWarbandHeroDetail,
  getWarbandHiredSwordDetail,
  listWarbandHenchmenGroups,
  listWarbandTrades,
  updateWarbandHenchmenGroup,
  updateWarbandHiredSword,
  updateWarbandHero,
} from "@/features/warbands/api/warbands-api";
import { emitWarbandUpdate } from "@/features/warbands/api/warbands-events";
import { getSignedTradePrice } from "@/features/warbands/utils/warband-utils";

import type { Item } from "../types/item-types";
import type { HenchmenGroup } from "@/features/warbands/types/warband-types";
import type { UnitSelectEntry, UnitTypeOption } from "@components/unit-selection-section";

export type AcquireItemMeta = {
  isBuying: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  reason: string;
};

export type DraftUnit = {
  unitType: UnitTypeOption;
  id: string;
  name?: string | null;
  unit_type?: string | null;
};

type HeroOption = {
  id: number | string;
  name?: string | null;
};

export type AcquireItemDialogSharedParams = {
  item: Item;
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  presetUnitType?: UnitTypeOption;
  presetUnitId?: number | string;
  draftUnit?: DraftUnit;
  disableUnitSelection: boolean;
  defaultUnitSectionCollapsed?: boolean;
  defaultRaritySectionCollapsed?: boolean;
  defaultPriceSectionCollapsed?: boolean;
  onAcquire?: (item: Item, unitType: UnitTypeOption, unitId: string, meta?: AcquireItemMeta) => void;
  emitWarbandUpdate: boolean;
  deferCommit: boolean;
  reservedGold: number;
  enableHenchmenAutoQuantity?: boolean;
};

export type AcquireItemDialogState = {
  triggerNode: ReactNode | null;
  resolvedSelectOpen: boolean;
  handleSelectOpenChange: (nextOpen: boolean) => void;
  isBuying: boolean;
  setIsBuying: Dispatch<SetStateAction<boolean>>;
  selectionLabel: string;
  selectionSummary: { label: string };
  raritySummary: { label: string; rollSummary: string; success: boolean | null };
  priceSummary: { text: string; variable: string };
  isUnitSelectionCollapsed: boolean;
  setIsUnitSelectionCollapsed: Dispatch<SetStateAction<boolean>>;
  isRarityCollapsed: boolean;
  setIsRarityCollapsed: Dispatch<SetStateAction<boolean>>;
  isPriceCollapsed: boolean;
  setIsPriceCollapsed: Dispatch<SetStateAction<boolean>>;
  unitTypes: UnitTypeOption[];
  resolvedUnitType: UnitTypeOption | "";
  resolvedUnitId: string;
  setSelectedUnitType: Dispatch<SetStateAction<UnitTypeOption | "">>;
  setSelectedUnitId: Dispatch<SetStateAction<string>>;
  units: UnitSelectEntry[];
  error: string;
  disableUnitSelection: boolean;
  isCommonRarity: boolean;
  heroOptions: HeroOption[];
  searchingHeroId: string;
  handleSearchingHeroChange: (value: string) => void;
  rollLocked: boolean;
  rollDisabled: boolean;
  handleHeroRolled: (heroId: string) => void;
  modifierEnabled: boolean;
  handleModifierEnabledChange: (nextEnabled: boolean) => void;
  rarityModifier: number;
  setRarityModifier: Dispatch<SetStateAction<number>>;
  modifierReason: string;
  setModifierReason: Dispatch<SetStateAction<string>>;
  handleRarityRollTotalChange: (total: number) => void;
  finalPrice: number;
  setFinalPrice: Dispatch<SetStateAction<number>>;
  quantity: number;
  handleQuantityChange: (value: number) => void;
  itemReason: string;
  setItemReason: Dispatch<SetStateAction<string>>;
  actionDisabled: boolean;
  actionDisabledReason: string;
  isSubmitting: boolean;
  handleAcquire: () => Promise<void> | void;
  isGoldLoading: boolean;
  goldFetchError: string;
  goldValidationError: string;
};

export function useAcquireItemDialogShared({
  item,
  trigger,
  open: openProp,
  onOpenChange,
  presetUnitType,
  presetUnitId,
  draftUnit,
  disableUnitSelection,
  defaultUnitSectionCollapsed,
  defaultRaritySectionCollapsed,
  defaultPriceSectionCollapsed,
  onAcquire,
  emitWarbandUpdate: shouldEmitWarbandUpdate,
  deferCommit,
  reservedGold,
  enableHenchmenAutoQuantity = false,
}: AcquireItemDialogSharedParams): AcquireItemDialogState {
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
  const heroUnits = warband?.heroes ?? [];
  const hiredSwordUnits = warband?.hired_swords ?? [];

  const unitTypes: UnitTypeOption[] = ["heroes", "hiredswords", "henchmen", "stash"];
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
    setFinalPrice(item.cost ?? 0);
  }, [resolvedSelectOpen, item.id, item.cost]);

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

  const triggerNode =
    trigger === undefined ? (
      <BuyItemButton item={item} />
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

  const units = useMemo<UnitSelectEntry[]>(() => {
    if (!resolvedUnitType) {
      return [];
    }
    const draftEntry: UnitSelectEntry | null =
      draftUnit && draftUnit.unitType === resolvedUnitType
        ? {
            id: draftUnit.id,
            name: draftUnit.name ?? null,
            unit_type: draftUnit.unit_type ?? null,
          }
        : null;
    if (resolvedUnitType === "heroes") {
      const base = heroUnits;
      return draftEntry ? [...base, draftEntry] : base;
    }
    if (resolvedUnitType === "hiredswords") {
      const base = hiredSwordUnits;
      return draftEntry ? [...base, draftEntry] : base;
    }
    if (resolvedUnitType === "henchmen") {
      const base = henchmenGroups;
      return draftEntry ? [...base, draftEntry] : base;
    }
    return [];
  }, [resolvedUnitType, draftUnit, heroUnits, hiredSwordUnits, henchmenGroups]);

  const heroOptions = useMemo<HeroOption[]>(() => {
    const base = heroUnits;
    if (draftUnit?.unitType !== "heroes") {
      return base;
    }
    return [
      ...base,
      { id: draftUnit.id, name: draftUnit.name ?? null },
    ];
  }, [draftUnit, heroUnits]);

  const selectedUnitLabel = useMemo(() => {
    if (!resolvedUnitType) {
      return "";
    }
    if (resolvedUnitType === "stash") {
      return "Warband Stash";
    }
    const match = units.find((unit) => String(unit.id) === resolvedUnitId);
    return match?.name ?? "";
  }, [resolvedUnitId, resolvedUnitType, units]);

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
      ? ` -> ${rarityRollTotal} ${modifierText} = ${rarityTotal}`
      : "";
  const rarityRollSuccess =
    !isCommonRarity && rarityTotal !== null
      ? rarityTotal >= item.rarity
      : null;
  const selectionSummary = { label: selectedUnitLabel || " " };
  const raritySummary = { label: rarityLabel, rollSummary: rarityRollSummary, success: rarityRollSuccess };
  const priceSummaryText =
    isCommonRarity && isBuying && quantity > 1
      ? `${finalPrice} x ${quantity} = ${totalPrice} gc`
      : `${totalPrice} gc`;
  const priceSummary = { text: priceSummaryText, variable: hasVariableCost ? item.variable ?? "" : "" };

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

  const reservedGoldValue = Math.max(0, Number(reservedGold) || 0);
  const effectiveGold = availableGold === null ? null : Math.max(0, availableGold - reservedGoldValue);
  const resolvedGold = effectiveGold ?? 0;
  const isGoldBlocked =
    requiresGoldCheck &&
    (isGoldLoading ||
      Boolean(goldFetchError) ||
      effectiveGold === null ||
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
      if (resolvedUnitType === "hiredswords" && !resolvedUnitId) {
        return "Select a hired sword to receive the item.";
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
    if (!enableHenchmenAutoQuantity) {
      return;
    }
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
    enableHenchmenAutoQuantity,
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
    if (effectiveGold === null) {
      setGoldValidationError("");
      return;
    }
    if (totalPrice > effectiveGold) {
      setGoldValidationError(`Not enough gold crowns. Available: ${effectiveGold} gc.`);
      return;
    }
    setGoldValidationError("");
  }, [requiresGoldCheck, totalPrice, effectiveGold]);

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

  const handleSearchingHeroChange = (value: string) => {
    setSearchingHeroId(value);
    setSearcherTouched(true);
  };

  const handleHeroRolled = (heroId: string) => {
    if (!heroId) {
      return;
    }
    setRolledHeroIds((prev) => {
      const next = new Set(prev);
      next.add(heroId);
      return next;
    });
  };

  const handleRarityRollTotalChange = (total: number) => {
    setRarityRollTotal(total);

    if (!warband || !searchingHeroId) {
      return;
    }
    if (rolledHeroIds.has(searchingHeroId)) {
      return;
    }

    const heroName =
      heroOptions.find((hero) => String(hero.id) === searchingHeroId)?.name?.trim() ||
      "Unnamed Hero";
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

  const handleQuantityChange = (value: number) => {
    setQuantity(value);
    setQuantityTouched(true);
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
    let didCommit = false;
    let didClose = false;

    try {
      const count = isCommonRarity ? quantity : 1;
      if (deferCommit) {
        onAcquire?.(item, resolvedUnitType, resolvedUnitId, {
          isBuying,
          quantity: count,
          unitPrice: finalPrice,
          totalPrice,
          reason: itemReason,
        });
        handleSelectOpenChange(false);
        return;
      }
      if (resolvedUnitType === "stash") {
        await addWarbandItem(warband.id, item.id, {
          emitUpdate: false,
          quantity: count,
        });
      } else if (resolvedUnitType === "hiredswords") {
        const hiredSwordId = Number(resolvedUnitId);
        if (Number.isNaN(hiredSwordId)) {
          setError("Select a saved hired sword.");
          setIsSubmitting(false);
          return;
        }
        let hiredSword = hiredSwordUnits.find((unit) => unit.id === hiredSwordId);
        if (!hiredSword) {
          setIsSubmitting(false);
          return;
        }
        if (!Array.isArray((hiredSword as { items?: unknown }).items)) {
          hiredSword = await getWarbandHiredSwordDetail(warband.id, hiredSwordId);
        }
        const existingItemIds = (hiredSword.items ?? []).map((existing) => existing.id);
        await updateWarbandHiredSword(warband.id, hiredSwordId, {
          item_ids: [...existingItemIds, ...Array(count).fill(item.id)],
        } as any);
      } else if (resolvedUnitType === "henchmen") {
        const groupId = Number(resolvedUnitId);
        if (Number.isNaN(groupId)) {
          setError("Select a saved henchmen group.");
          setIsSubmitting(false);
          return;
        }
        let group = henchmenGroups.find((g) => g.id === groupId);
        if (!group) {
          setIsSubmitting(false);
          return;
        }
        if (!Array.isArray((group as { items?: unknown }).items)) {
          group = await getWarbandHenchmenGroupDetail(warband.id, groupId);
        }
        const existingItemIds = (group.items ?? []).map((existing) => existing.id);
        await updateWarbandHenchmenGroup(warband.id, groupId, {
          item_ids: [...existingItemIds, ...Array(count).fill(item.id)],
        } as any);
      } else {
        const heroId = Number(resolvedUnitId);
        if (Number.isNaN(heroId)) {
          setError("Select a saved hero.");
          setIsSubmitting(false);
          return;
        }
        let hero = heroUnits.find((unit) => unit.id === heroId);
        if (!hero) {
          setIsSubmitting(false);
          return;
        }
        if (!Array.isArray((hero as { items?: unknown }).items)) {
          hero = await getWarbandHeroDetail(warband.id, heroId);
        }
        const existingItemIds = (hero.items ?? []).map((existing) => existing.id);
        await updateWarbandHero(warband.id, heroId, {
          item_ids: [...existingItemIds, ...Array(count).fill(item.id)],
        } as any);
      }

      didCommit = true;
      onAcquire?.(item, resolvedUnitType, resolvedUnitId);

      const actorName =
        resolvedUnitType === "stash"
          ? "Stash"
          : resolvedUnitType === "hiredswords"
            ? hiredSwordUnits.find((u) => u.id === Number(resolvedUnitId))?.name?.trim() || "Unknown Hired Sword"
          : resolvedUnitType === "henchmen"
            ? henchmenGroups.find((g) => g.id === Number(resolvedUnitId))?.name?.trim() || "Unknown Group"
            : heroUnits.find((u) => u.id === Number(resolvedUnitId))?.name?.trim() || "Unknown Hero";

      const postActions: Promise<unknown>[] = [];

      if (isBuying && totalPrice > 0) {
        postActions.push(
          createWarbandTrade(
            warband.id,
            {
              action: "Bought",
              description: quantity > 1 ? `${item.name} x ${quantity}` : item.name,
              price: totalPrice,
            },
            { emitUpdate: false }
          )
        );
      }

      postActions.push(
        createWarbandLog(
          warband.id,
          {
            feature: "loadout",
            entry_type:
              resolvedUnitType === "henchmen"
                ? "henchmen_item"
                : resolvedUnitType === "hiredswords"
                  ? "hired_sword_item"
                  : "hero_item",
            payload: {
              hero: actorName,
              item: item.name,
              ...(isBuying && totalPrice > 0 ? { price: totalPrice } : {}),
              ...(quantity > 1 ? { quantity } : {}),
              ...(!isBuying && itemReason.trim() ? { reason: itemReason.trim() } : {}),
            },
          },
          { emitUpdate: false }
        )
      );

      const results = await Promise.allSettled(postActions);
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Post-acquire action failed", result.reason);
        }
      });

      if (shouldEmitWarbandUpdate) {
        emitWarbandUpdate(warband.id);
      }
      handleSelectOpenChange(false);
      didClose = true;
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Unable to acquire item");
      } else {
        setError("Unable to acquire item");
      }
    } finally {
      if (didCommit && !didClose) {
        handleSelectOpenChange(false);
      }
      setIsSubmitting(false);
    }
  };

  return {
    triggerNode,
    resolvedSelectOpen,
    handleSelectOpenChange,
    isBuying,
    setIsBuying,
    selectionLabel,
    selectionSummary,
    raritySummary,
    priceSummary,
    isUnitSelectionCollapsed,
    setIsUnitSelectionCollapsed,
    isRarityCollapsed,
    setIsRarityCollapsed,
    isPriceCollapsed,
    setIsPriceCollapsed,
    unitTypes,
    resolvedUnitType,
    resolvedUnitId,
    setSelectedUnitType,
    setSelectedUnitId,
    units,
    error,
    isCommonRarity,
    heroOptions,
    searchingHeroId,
    handleSearchingHeroChange,
    rollLocked: hasHeroRolled,
    rollDisabled: !searchingHeroId || hasHeroRolled,
    handleHeroRolled,
    modifierEnabled,
    handleModifierEnabledChange,
    rarityModifier,
    setRarityModifier,
    modifierReason,
    setModifierReason,
    handleRarityRollTotalChange,
    finalPrice,
    setFinalPrice,
    quantity,
    handleQuantityChange,
    itemReason,
    setItemReason,
    actionDisabled,
    actionDisabledReason,
    isSubmitting,
    handleAcquire,
    isGoldLoading,
    goldFetchError,
    goldValidationError,
    disableUnitSelection,
  };
}
