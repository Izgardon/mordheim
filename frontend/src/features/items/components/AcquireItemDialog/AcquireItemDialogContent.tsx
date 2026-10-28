import { Check, X } from "lucide-react";

// components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { UnitSelectionSection } from "@components/unit-selection-section";
import CollapsibleSection from "@/components/ui/collapsible-section";
import SummaryPill from "./SummaryPill";
import PriceSection from "./PriceSection";
import RaritySection from "./RaritySection";
import AcquireActions from "./AcquireActions";
import AcquireBeastOptions from "./AcquireBeastOptions";
import {
  AcquireHelpButton,
  AcquireModeToggle,
  AcquiringItemLabel,
  AvailabilitySelect,
  GiveReasonField,
} from "./AcquireDialogParts";

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
  rollDisabled,
  isSavingRarityRoll,
  hasStoredRarityRoll,
  currentRarityRoll,
  modifierEnabled,
  handleModifierEnabledChange,
  rarityModifier,
  setRarityModifier,
  modifierReason,
  setModifierReason,
  handleRarityRollTotalChange,
  basePrice,
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
  overspendConfirm,
  notice,
  availabilities,
  selectedAvailabilityId,
  setSelectedAvailabilityId,
  resolvedAvailability,
  beast,
}: AcquireItemDialogContentProps) {
  const selectionSummaryNode = (
    <SummaryPill className="min-w-[200px] text-center">{selectionSummary.label}</SummaryPill>
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
      {triggerNode !== null ? <DialogTrigger asChild>{triggerNode}</DialogTrigger> : null}
      <DialogContent className="max-w-[720px]">
        <DialogTitle className="sr-only">Acquire item</DialogTitle>
        <DialogDescription className="sr-only">
          Buy or give {item.name} to a unit or the warband stash.
        </DialogDescription>
        <AcquireHelpButton />
        <div className="space-y-6 pr-3">
          <AcquireModeToggle isBuying={isBuying} onChange={setIsBuying} />
          <AcquiringItemLabel item={item} availability={resolvedAvailability} />
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
          <AcquireBeastOptions itemName={item.name} {...beast} />
          <div className="mx-auto w-4/5 border-t border-border/40" />
          {availabilities.length > 1 && (
            <AvailabilitySelect
              availabilities={availabilities}
              selectedId={selectedAvailabilityId}
              onChange={setSelectedAvailabilityId}
            />
          )}
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
                    rarity={resolvedAvailability?.rarity ?? 2}
                    heroes={heroOptions}
                    searchingHeroId={searchingHeroId}
                    onSearchingHeroChange={handleSearchingHeroChange}
                    rollDisabled={rollDisabled}
                    isSavingRarityRoll={isSavingRarityRoll}
                    hasStoredRarityRoll={hasStoredRarityRoll}
                    currentRarityRoll={currentRarityRoll}
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
                  cost={basePrice}
                  variable={resolvedAvailability?.variable_cost}
                  finalPrice={finalPrice}
                  onFinalPriceChange={setFinalPrice}
                  isCommon={isCommonRarity}
                  quantity={quantity}
                  onQuantityChange={handleQuantityChange}
                />
              </CollapsibleSection>
            </div>
          ) : (
            <GiveReasonField value={itemReason} onChange={setItemReason} />
          )}
          <AcquireActions
            isBuying={isBuying}
            isSubmitting={isSubmitting}
            actionDisabled={actionDisabled}
            actionDisabledReason={actionDisabledReason}
            notice={notice}
            onAcquire={handleAcquire}
            onCancel={() => handleSelectOpenChange(false)}
            overspendConfirm={overspendConfirm}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
