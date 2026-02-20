import type { ChangeEvent } from "react";
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
import { UnitSelectionSection } from "@components/unit-selection-section";
import CollapsibleSection from "@/components/ui/collapsible-section";
import SummaryPill from "./SummaryPill";
import PriceSection from "./PriceSection";
import RaritySection from "./RaritySection";

// assets
import basicBar from "@/assets/containers/basic_bar.webp";
import helpIcon from "@/assets/components/help.webp";

// types
import type { Item } from "../../types/item-types";
import type { AcquireItemDialogState } from "../../hooks/useAcquireItemDialogShared";

type AcquireItemDialogContentProps = AcquireItemDialogState & {
  item: Item;
};

export default function AcquireItemDialogContent({
  item,
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
  disableUnitSelection,
  isCommonRarity,
  heroOptions,
  searchingHeroId,
  handleSearchingHeroChange,
  rollLocked,
  rollDisabled,
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
}: AcquireItemDialogContentProps) {
  const selectionSummaryNode = (
    <SummaryPill className="min-w-[200px] text-center">
      {selectionSummary.label}
    </SummaryPill>
  );

  const raritySummaryNode = (
    <SummaryPill>
      <span className="inline-flex items-center gap-2">
        <span>
          {raritySummary.label}
          {raritySummary.rollSummary}
        </span>
        {raritySummary.success === null ? null : raritySummary.success ? (
          <Check className="h-4 w-4 text-emerald-400" />
        ) : (
          <X className="h-4 w-4 text-red-400" />
        )}
      </span>
    </SummaryPill>
  );

  const priceSummaryNode = (
    <SummaryPill>
      {priceSummary.text}
      {priceSummary.variable ? (
        <span className="text-muted-foreground"> {priceSummary.variable}</span>
      ) : null}
    </SummaryPill>
  );

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
                    onSearchingHeroChange={handleSearchingHeroChange}
                    rollLocked={rollLocked}
                    rollDisabled={rollDisabled}
                    onHeroRolled={handleHeroRolled}
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
                  onQuantityChange={handleQuantityChange}
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
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setItemReason(event.target.value)}
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
