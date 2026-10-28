import UnitSection from "../units/UnitSection";
import WarbandResourceBar from "./resources/WarbandResourceBar";

import type { WarbandEditors } from "../../hooks/warband/useWarbandPage";
import type { WarbandCapabilities } from "../../types/warband-sheet";
import type { WarbandRosterEditSection } from "../../hooks/warband/useWarbandMobileTopBar";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
  WarbandResource,
} from "../../types/warband-types";

type WarbandTabContentProps = {
  warbandId: number;
  resources: WarbandResource[];
  capabilities: WarbandCapabilities;
  editors: WarbandEditors;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  levelThresholds: {
    heroes?: readonly number[];
    henchmen?: readonly number[];
    hirelings?: readonly number[];
  };
  availableGold: number;
  layoutVariant?: "default" | "mobile";
  sectionActionsHidden?: Partial<Record<WarbandRosterEditSection, boolean>>;
  showLoadoutOnMobile?: boolean;
  /** The warband is over its size limit: a warning, never a block (decision 12). */
  sizeWarning?: string | null;
};

/**
 * The Warband tab: resources, then the Heroes, Henchmen and Hired Swords sections, each control
 * gated on the sheet's capabilities (BUG-31).
 */
export default function WarbandTabContent({
  warbandId,
  resources,
  capabilities,
  editors,
  heroes,
  henchmenGroups,
  hirelings,
  levelThresholds,
  availableGold,
  layoutVariant = "default",
  sectionActionsHidden,
  showLoadoutOnMobile = false,
  sizeWarning = null,
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
        canEdit={capabilities.manage_items}
        variant={layoutVariant === "mobile" ? "plain" : "card"}
      />
      {sizeWarning ? (
        <p
          role="status"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200"
        >
          {sizeWarning}
        </p>
      ) : null}
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
        editor={editors.hirelings}
        units={hirelings}
        actionsHidden={sectionActionsHidden?.hirelings ?? false}
        levelThresholds={levelThresholds.hirelings}
      />
    </>
  );
}
