import type { ComponentProps } from "react";

import WarbandHeroesSection from "../heroes/WarbandHeroesSection";
import WarbandHenchmenSection from "../henchmen/WarbandHenchmenSection";
import WarbandHiredSwordsSection from "../hiredswords/WarbandHiredSwordsSection";
import WarbandResourceBar from "./resources/WarbandResourceBar";

import type { Item } from "../../../items/types/item-types";
import type { WarbandHiredSword, WarbandResource } from "../../types/warband-types";

type WarbandTabContentProps = ComponentProps<typeof WarbandHeroesSection> & {
  warbandId: number;
  resources: WarbandResource[];
  onResourcesUpdated: (resources: WarbandResource[]) => void;
  onItemCreated: (index: number, item: Item) => void;
  saveError: string;
  canEdit: boolean;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onEditHeroes: () => void;
  isLoadingHeroDetails: boolean;
  maxHiredSwords: number;
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  onHiredSwordsChange?: (hiredSwords: WarbandHiredSword[]) => void;
};

export default function WarbandTabContent({
  warbandId,
  resources,
  onResourcesUpdated,
  onItemCreated,
  saveError,
  canEdit,
  isSaving,
  onSave,
  onCancel,
  onEditHeroes,
  isLoadingHeroDetails,
  maxHiredSwords,
  onHiredSwordUpdated,
  onHiredSwordsChange,
  ...heroSectionProps
}: WarbandTabContentProps) {
  return (
    <>
      <WarbandResourceBar
        warbandId={warbandId}
        resources={resources}
        onResourcesUpdated={onResourcesUpdated}
        canEdit={canEdit}
      />

      <WarbandHeroesSection
        {...heroSectionProps}
        warbandId={warbandId}
        canEdit={canEdit}
        onEditHeroes={onEditHeroes}
        onSaveHeroes={onSave}
        onCancelHeroes={onCancel}
        isSavingHeroes={isSaving}
        isLoadingHeroDetails={isLoadingHeroDetails}
        heroSaveError={saveError}
        onItemCreated={onItemCreated}
      />

      <WarbandHenchmenSection
        warbandId={warbandId}
        canEdit={canEdit}
        availableItems={heroSectionProps.availableItems}
        availableSkills={heroSectionProps.availableSkills}
        availableSpecials={heroSectionProps.availableSpecials}
        availableRaces={heroSectionProps.availableRaces}
        canAddCustom={heroSectionProps.canAddCustom}
        itemsError={heroSectionProps.itemsError}
        skillsError={heroSectionProps.skillsError}
        specialsError={heroSectionProps.specialsError}
        racesError={heroSectionProps.racesError}
        isItemsLoading={heroSectionProps.isItemsLoading}
        isSkillsLoading={heroSectionProps.isSkillsLoading}
        isSpecialsLoading={heroSectionProps.isSpecialsLoading}
        isRacesLoading={heroSectionProps.isRacesLoading}
        campaignId={heroSectionProps.campaignId}
        statFields={heroSectionProps.statFields}
        onRaceCreated={heroSectionProps.onRaceCreated}
        availableGold={heroSectionProps.availableGold ?? 0}
        onItemCreated={onItemCreated}
      />

      <WarbandHiredSwordsSection
        warbandId={warbandId}
        canEdit={canEdit}
        maxHiredSwords={maxHiredSwords}
        availableItems={heroSectionProps.availableItems}
        availableSkills={heroSectionProps.availableSkills}
        availableSpells={heroSectionProps.availableSpells}
        availableSpecials={heroSectionProps.availableSpecials}
        availableRaces={heroSectionProps.availableRaces}
        canAddCustom={heroSectionProps.canAddCustom}
        itemsError={heroSectionProps.itemsError}
        skillsError={heroSectionProps.skillsError}
        spellsError={heroSectionProps.spellsError}
        specialsError={heroSectionProps.specialsError}
        racesError={heroSectionProps.racesError}
        isItemsLoading={heroSectionProps.isItemsLoading}
        isSkillsLoading={heroSectionProps.isSkillsLoading}
        isSpellsLoading={heroSectionProps.isSpellsLoading}
        isSpecialsLoading={heroSectionProps.isSpecialsLoading}
        isRacesLoading={heroSectionProps.isRacesLoading}
        campaignId={heroSectionProps.campaignId}
        statFields={heroSectionProps.statFields}
        skillFields={heroSectionProps.skillFields}
        onRaceCreated={heroSectionProps.onRaceCreated}
        onHiredSwordUpdated={onHiredSwordUpdated}
        onHiredSwordsChange={onHiredSwordsChange}
        availableGold={heroSectionProps.availableGold ?? 0}
        onItemCreated={onItemCreated}
      />
    </>
  );
}
