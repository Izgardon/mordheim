import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { useUnitSectionEditor, type UnitSectionEditor } from "../units/useUnitSectionEditor";
import { useWarbandMobileTopBar, type WarbandRosterEditSection } from "./useWarbandMobileTopBar";
import { heroKind, henchmenKind, hiredSwordKind } from "../../units/unit-kinds";

import type { CampaignLayoutContext } from "../../../campaigns/routes/CampaignLayout";
import type { Unit, UnitKindKey } from "../../types/units";
import type { Warband } from "../../types/warband-types";

export type WarbandTab = "warband" | "treasury" | "backstory" | "logs";
export const WARBAND_TABS: { id: WarbandTab; label: string }[] = [
  { id: "warband", label: "Warband" },
  { id: "treasury", label: "Treasury" },
  { id: "backstory", label: "Backstory" },
  { id: "logs", label: "Logs" },
];
const SECTIONS: WarbandRosterEditSection[] = ["heroes", "henchmen", "hiredswords"];

const resolveWarbandTab = (value: string | null): WarbandTab | null =>
  WARBAND_TABS.find((tab) => tab.id === value)?.id ?? null;

export type WarbandEditors = {
  heroes: UnitSectionEditor<"hero">;
  henchmen: UnitSectionEditor<"henchmen_group">;
  hiredswords: UnitSectionEditor<"hired_sword">;
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
  const { isEditing, navigationItems, cancelEditing } = editor;
  const { isSaving, handleSaveChanges } = editor.save;
  useEffect(() => {
    handleMobileEditChange(section, {
      isEditing,
      onSave: handleSaveChanges,
      onCancel: cancelEditing,
      isSaving,
      navigationItems,
    });
  }, [
    cancelEditing,
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
  const handleTabChange = (tabId: string) => {
    const nextTab = resolveWarbandTab(tabId) ?? "warband";
    const nextParams = new URLSearchParams(searchParams);
    if (nextTab === "warband") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const limits = {
    maxHeroes: campaign?.max_heroes ?? 6,
    maxHiredSwords: campaign?.max_hired_swords ?? 3,
    maxUnits: warband?.max_units ?? 15,
    heroCount: roster.hero.length,
    henchmanCount: roster.henchmen_group.reduce((total, g) => total + (g.henchmen?.length ?? 0), 0),
    bloodPactedCount: roster.hired_sword.filter((hs) => hs.blood_pacted).length,
  };
  const shared = { warbandId: warband?.id ?? 0, canEdit, roster: limits };
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
    hiredswords: useUnitSectionEditor(hiredSwordKind, {
      ...shared,
      units: roster.hired_sword,
      onUnitsChange: setUnits.hired_sword,
    }),
  };

  const heroEditor = editors.heroes;
  const { handleMobileEditChange, isMobileEditing } = useWarbandMobileTopBar({
    isMobile,
    isEditing: heroEditor.isEditing,
    isSaving: heroEditor.save.isSaving,
    handleSaveChanges: heroEditor.save.handleSaveChanges,
    cancelEditing: heroEditor.cancelEditing,
    setMobileTopBar,
    warbandName: warband?.name,
    isLoadingWarband,
    hasRejoinButton,
    heroEditNavigationItems: heroEditor.navigationItems,
  });
  useSectionMobileEdit("henchmen", editors.henchmen, handleMobileEditChange);
  useSectionMobileEdit("hiredswords", editors.hiredswords, handleMobileEditChange);

  // Leaving the Warband tab ends every edit session (the sections unmount with the tab).
  const editorsRef = useRef(editors);
  editorsRef.current = editors;
  const endEditing = useCallback(() => {
    for (const section of SECTIONS) {
      editorsRef.current[section].cancelEditing();
    }
    handleMobileEditChange("henchmen", { isEditing: false });
    handleMobileEditChange("hiredswords", { isEditing: false });
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

  return {
    activeTab,
    handleTabChange,
    editors,
    sectionActionsHidden,
    levelThresholds: {
      heroes: campaign?.[heroKind.thresholdsKey],
      henchmen: campaign?.[henchmenKind.thresholdsKey],
      hiredswords: campaign?.[hiredSwordKind.thresholdsKey],
    },
  };
}
