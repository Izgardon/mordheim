import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { useUnitSectionEditor, type UnitSectionEditor } from "../units/useUnitSectionEditor";
import { useDiscardGuard } from "./useDiscardGuard";
import { useWarbandMobileTopBar, type WarbandRosterEditSection } from "./useWarbandMobileTopBar";
import { heroKind, henchmenKind, hirelingKind } from "../../units/unit-kinds";
import { getWarbandUnitCount } from "../../utils/warband-utils";
import { takesHiredSwordPlace } from "../../units/kinds/hireling-terms";

import type { CampaignLayoutContext } from "../../../campaigns/routes/CampaignLayout";
import type { Unit, UnitKindKey } from "../../types/units";
import type { Warband } from "../../types/warband-types";
import type { RosterLimits } from "../../units/unit-kind-types";

export type WarbandTab = "warband" | "treasury" | "backstory" | "logs";
export const WARBAND_TABS: { id: WarbandTab; label: string }[] = [
  { id: "warband", label: "Warband" },
  { id: "treasury", label: "Treasury" },
  { id: "backstory", label: "Backstory" },
  { id: "logs", label: "Logs" },
];
const SECTIONS: WarbandRosterEditSection[] = ["heroes", "henchmen", "hirelings"];

const resolveWarbandTab = (value: string | null): WarbandTab | null =>
  WARBAND_TABS.find((tab) => tab.id === value)?.id ?? null;

export type WarbandEditors = {
  heroes: UnitSectionEditor<"hero">;
  henchmen: UnitSectionEditor<"henchmen_group">;
  hirelings: UnitSectionEditor<"hireling">;
};

type Roster = { [K in UnitKindKey]: Unit<K>[] };

type UseWarbandPageOptions = {
  campaign: CampaignLayoutContext["campaign"];
  warband: Warband | null;
  roster: Roster;
  setUnits: { [K in UnitKindKey]: (units: Unit<K>[]) => void };
  onWarbandSaved: (warband: Warband) => void;
  canEdit: boolean;
  isMobile: boolean;
  isLoadingWarband: boolean;
  setMobileTopBar: CampaignLayoutContext["setMobileTopBar"];
  hasRejoinButton?: boolean;
};

/** Mirrors one section's edit session into the mobile top bar (Save/Cancel, jump list). */
function useSectionMobileEdit<K extends UnitKindKey>(
  section: WarbandRosterEditSection,
  editor: UnitSectionEditor<K>,
  handleMobileEditChange: ReturnType<typeof useWarbandMobileTopBar>["handleMobileEditChange"]
) {
  const { isEditing, navigationItems, requestCancel } = editor;
  const { isSaving, handleSaveChanges } = editor.save;
  useEffect(() => {
    handleMobileEditChange(section, {
      isEditing,
      onSave: handleSaveChanges,
      onCancel: requestCancel,
      isSaving,
      navigationItems,
    });
  }, [
    requestCancel,
    handleMobileEditChange,
    handleSaveChanges,
    isEditing,
    isSaving,
    navigationItems,
    section,
  ]);
}

/**
 * The warband page's state: the active tab, the three sections' edit sessions and how they
 * share the screen (one section edits at a time; on phones the top bar carries Save/Cancel).
 */
export function useWarbandPage({
  campaign,
  warband,
  roster,
  setUnits,
  onWarbandSaved,
  canEdit,
  isMobile,
  isLoadingWarband,
  setMobileTopBar,
  hasRejoinButton,
}: UseWarbandPageOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = resolveWarbandTab(searchParams.get("tab")) ?? "warband";
  const { confirmDiscard, dialog: discardDialog } = useDiscardGuard();

  // The caps and their counts come from the server's summary (decision 12); the sheet holds
  // living units only, so its lists stand in until a summary has them.
  const limits: RosterLimits = {
    maxHeroes: warband?.max_heroes ?? campaign?.max_heroes ?? 6,
    maxHiredSwords: warband?.max_hired_swords ?? campaign?.max_hired_swords ?? 3,
    heroCount: warband?.hero_count ?? roster.hero.length,
    hirelingCount: warband?.hireling_count ?? roster.hireling.filter(takesHiredSwordPlace).length,
  };
  const shared = { warbandId: warband?.id ?? 0, canEdit, roster: limits, confirmDiscard };
  const editors: WarbandEditors = {
    heroes: useUnitSectionEditor(heroKind, {
      ...shared,
      units: roster.hero,
      onUnitsChange: setUnits.hero,
      warband,
      onWarbandSaved,
    }),
    henchmen: useUnitSectionEditor(henchmenKind, {
      ...shared,
      units: roster.henchmen_group,
      onUnitsChange: setUnits.henchmen_group,
    }),
    hirelings: useUnitSectionEditor(hirelingKind, {
      ...shared,
      units: roster.hireling,
      onUnitsChange: setUnits.hireling,
    }),
  };

  // Leaving the Warband tab ends every edit session, so it asks first when that loses edits.
  const handleTabChange = (tabId: string) => {
    const nextTab = resolveWarbandTab(tabId) ?? "warband";
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "warband") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    confirmDiscard({
      isDirty: nextTab !== activeTab && SECTIONS.some((section) => editors[section].isDirty),
      message: "Discard your unsaved roster changes and leave the Warband tab?",
      discard: () => setSearchParams(nextParams, { replace: true }),
    });
  };

  const heroEditor = editors.heroes;
  const { handleMobileEditChange, isMobileEditing } = useWarbandMobileTopBar({
    isMobile,
    isEditing: heroEditor.isEditing,
    isSaving: heroEditor.save.isSaving,
    handleSaveChanges: heroEditor.save.handleSaveChanges,
    cancelEditing: heroEditor.requestCancel,
    setMobileTopBar,
    warbandName: warband?.name,
    isLoadingWarband,
    hasRejoinButton,
    heroEditNavigationItems: heroEditor.navigationItems,
  });
  useSectionMobileEdit("henchmen", editors.henchmen, handleMobileEditChange);
  useSectionMobileEdit("hirelings", editors.hirelings, handleMobileEditChange);

  // Leaving the Warband tab ends every edit session (the sections unmount with the tab).
  const editorsRef = useRef(editors);
  editorsRef.current = editors;
  const endEditing = useCallback(() => {
    for (const section of SECTIONS) {
      editorsRef.current[section].cancelEditing();
    }
    handleMobileEditChange("henchmen", { isEditing: false });
    handleMobileEditChange("hirelings", { isEditing: false });
  }, [handleMobileEditChange]);
  useEffect(() => {
    if (activeTab !== "warband") {
      endEditing();
    }
  }, [activeTab, endEditing]);

  // On desktop the section being edited hides the others' actions.
  const activeSection = isMobile ? null : (SECTIONS.find((s) => editors[s].isEditing) ?? null);
  const sectionActionsHidden = Object.fromEntries(
    SECTIONS.map((s) => [s, isMobileEditing || (activeSection !== null && activeSection !== s)])
  ) as Record<WarbandRosterEditSection, boolean>;

  // What the section being edited will spend on Save: queued recruits and purchases.
  const pendingGold = SECTIONS.reduce(
    (sum, section) =>
      sum + (editors[section].isEditing ? editors[section].purchases.pendingSpend : 0),
    0
  );

  // Warband size only warns (decision 12). An edit counts its forms, queued recruits included.
  const isAnyEditing = SECTIONS.some((section) => editors[section].isEditing);
  const unitCount = isAnyEditing
    ? getWarbandUnitCount(
        editors.heroes.isEditing ? editors.heroes.forms.forms : roster.hero,
        editors.hirelings.isEditing ? editors.hirelings.forms.forms : roster.hireling,
        editors.henchmen.isEditing ? editors.henchmen.forms.forms : roster.henchmen_group
      )
    : (warband?.unit_count ??
      getWarbandUnitCount(roster.hero, roster.hireling, roster.henchmen_group));
  const maxUnits = warband?.max_units || 15;
  const sizeWarning =
    unitCount > maxUnits
      ? `Your warband has ${unitCount} units, over its limit of ${maxUnits}. Heroes, henchmen and blood-pacted hired swords count.`
      : null;

  return {
    activeTab,
    handleTabChange,
    discardDialog,
    pendingGold,
    sizeWarning,
    editors,
    sectionActionsHidden,
    levelThresholds: {
      heroes: campaign?.[heroKind.thresholdsKey],
      henchmen: campaign?.[henchmenKind.thresholdsKey],
      hirelings: campaign?.[hirelingKind.thresholdsKey],
    },
  };
}
