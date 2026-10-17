import { createContext, useContext, useMemo, type PropsWithChildren } from "react";

import { useCampaignCatalogues } from "../../hooks/campaign/useCampaignCatalogues";

import type { Item } from "@/features/items/types/item-types";
import type { Race } from "@/features/races/types/race-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

/** The campaign's catalogue as the roster sections use it (instead of ~15 props each). */
export type WarbandCatalogue = {
  campaignId: number;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  availableRaces: Race[];
  itemsError: string;
  skillsError: string;
  spellsError: string;
  specialsError: string;
  racesError: string;
  isItemsLoading: boolean;
  isSkillsLoading: boolean;
  isSpellsLoading: boolean;
  isSpecialsLoading: boolean;
  isRacesLoading: boolean;
  canAddCustom: boolean;
  onRaceCreated: (race: Race) => void;
};

export const WarbandCatalogueContext = createContext<WarbandCatalogue | null>(null);

export function useWarbandCatalogue() {
  const catalogue = useContext(WarbandCatalogueContext);
  if (!catalogue) {
    throw new Error("useWarbandCatalogue must be used within WarbandCatalogueProvider");
  }
  return catalogue;
}

type WarbandCatalogueProviderProps = PropsWithChildren<{
  campaignId: number;
  canAddCustom: boolean;
}>;

export function WarbandCatalogueProvider({
  campaignId,
  canAddCustom,
  children,
}: WarbandCatalogueProviderProps) {
  const c = useCampaignCatalogues(campaignId);
  const value = useMemo<WarbandCatalogue>(
    () => ({
      campaignId,
      availableItems: c.availableItems,
      availableSkills: c.availableSkills,
      availableSpells: c.availableSpells,
      availableSpecials: c.availableSpecials,
      availableRaces: c.availableRaces,
      itemsError: c.itemsError,
      skillsError: c.skillsError,
      spellsError: c.spellsError,
      specialsError: c.specialsError,
      racesError: c.racesError,
      isItemsLoading: c.isItemsLoading,
      isSkillsLoading: c.isSkillsLoading,
      isSpellsLoading: c.isSpellsLoading,
      isSpecialsLoading: c.isSpecialsLoading,
      isRacesLoading: c.isRacesLoading,
      canAddCustom,
      onRaceCreated: c.handleRaceCreated,
    }),
    [
      campaignId,
      canAddCustom,
      c.availableItems,
      c.availableSkills,
      c.availableSpells,
      c.availableSpecials,
      c.availableRaces,
      c.itemsError,
      c.skillsError,
      c.spellsError,
      c.specialsError,
      c.racesError,
      c.isItemsLoading,
      c.isSkillsLoading,
      c.isSpellsLoading,
      c.isSpecialsLoading,
      c.isRacesLoading,
      c.handleRaceCreated,
    ]
  );
  return (
    <WarbandCatalogueContext.Provider value={value}>{children}</WarbandCatalogueContext.Provider>
  );
}
