import UnitSection from "../units/UnitSection";
import WarbandResourceBar from "./resources/WarbandResourceBar";

import type { WarbandEditors } from "../../hooks/warband/useWarbandPage";
import type { WarbandCapabilities } from "../../types/warband-sheet";
import type { WarbandRosterEditSection } from "../../hooks/warband/useWarbandMobileTopBar";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHiredSword,
  WarbandResource,
} from "../../types/warband-types";

type WarbandTabContentProps = {
  warbandId: number;
  resources: WarbandResource[];
  onResourcesUpdated: (resources: WarbandResource[]) => void;
  capabilities: WarbandCapabilities;
  editors: WarbandEditors;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hiredSwords: WarbandHiredSword[];
  levelThresholds: {
    heroes?: readonly number[];
    henchmen?: readonly number[];
    hiredswords?: readonly number[];
  };
  availableGold: number;
  layoutVariant?: "default" | "mobile";
  sectionActionsHidden?: Partial<Record<WarbandRosterEditSection, boolean>>;
  showLoadoutOnMobile?: boolean;
};

/**
 * The Warband tab: resources, then the Heroes, Henchmen and Hired Swords sections, each control
 * gated on the sheet's capabilities (BUG-31).
 */
export default function WarbandTabContent({
  warbandId,
  resources,
  onResourcesUpdated,
  capabilities,
  editors,
  heroes,
  henchmenGroups,
  hiredSwords,
  levelThresholds,
  availableGold,
  layoutVariant = "default",
  sectionActionsHidden,
  showLoadoutOnMobile = false,
}: WarbandTabContentProps) {
  const shared = {
    warbandId,
    canEdit: capabilities.edit,
    canLevelUp: capabilities.level_up,
    canManageItems: capabilities.manage_items,
    layoutVariant,
    availableGold,
    showLoadoutOnMobile,
  };
  return (
    <>
      <WarbandResourceBar
        warbandId={warbandId}
        resources={resources}
        onResourcesUpdated={onResourcesUpdated}
        canEdit={capabilities.manage_items}
        variant={layoutVariant === "mobile" ? "plain" : "card"}
      />
      <UnitSection
        {...shared}
        editor={editors.heroes}
        units={heroes}
        actionsHidden={sectionActionsHidden?.heroes ?? false}
        levelThresholds={levelThresholds.heroes}
      />
      <UnitSection
        {...shared}
        editor={editors.henchmen}
        units={henchmenGroups}
        actionsHidden={sectionActionsHidden?.henchmen ?? false}
        levelThresholds={levelThresholds.henchmen}
      />
      <UnitSection
        {...shared}
        editor={editors.hiredswords}
        units={hiredSwords}
        actionsHidden={sectionActionsHidden?.hiredswords ?? false}
        levelThresholds={levelThresholds.hiredswords}
      />
    </>
  );
}
