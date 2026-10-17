import UnitLevelUpControl from "../UnitLevelUpControl";
import UnitSummaryCard from "../UnitSummaryCard";

import type { Spell } from "@/features/spells/types/spell-types";
import type { UnitSectionEditor } from "../../../hooks/units/useUnitSectionEditor";
import type { Unit, UnitKindKey } from "../../../types/units";

type UnitSectionRosterProps<K extends UnitKindKey> = {
  editor: UnitSectionEditor<K>;
  units: Unit<K>[];
  warbandId: number;
  canEdit: boolean;
  canLevelUp: boolean;
  canManageItems: boolean;
  isMobileLayout: boolean;
  visuallyExpandedId: number | null;
  availableSpells: Spell[];
  levelThresholds?: readonly number[];
  showLoadoutOnMobile: boolean;
};

/** The section's summary cards: a column on phones, the hero grid on desktop. */
export default function UnitSectionRoster<K extends UnitKindKey>({
  editor,
  units,
  warbandId,
  canEdit,
  canLevelUp,
  canManageItems,
  isMobileLayout,
  visuallyExpandedId,
  availableSpells,
  levelThresholds,
  showLoadoutOnMobile,
}: UnitSectionRosterProps<K>) {
  const { kind } = editor;

  const card = (unit: Unit<K>) => {
    const isExpanded = editor.forms.expandedId === unit.id;
    const levelUpControl = canLevelUp ? (
      <UnitLevelUpControl
        kind={kind}
        unit={unit}
        warbandId={warbandId}
        onLevelUpLogged={editor.replaceUnit}
        onGroupRemoved={editor.removeUnit}
        trigger={
          <button
            type="button"
            className={`level-up-banner${isExpanded ? " level-up-banner--expanded" : ""} absolute left-1/2 top-0 rounded-full border border-[#6e5a3b] bg-[#3b2a1a] px-4 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-[#f5d97b]`}
          >
            Level Up!
          </button>
        }
      />
    ) : undefined;

    return (
      <UnitSummaryCard
        kind={kind}
        unit={unit}
        warbandId={warbandId}
        isExpanded={isExpanded}
        {...(isMobileLayout
          ? { expandButtonPlacement: "bottom" as const, fullWidthItems: true }
          : {})}
        onUnitUpdated={editor.replaceUnit}
        onPendingEntryClick={editor.editPendingEntry}
        availableSpells={availableSpells}
        levelUpControl={levelUpControl}
        levelThresholds={levelThresholds}
        layoutVariant={isMobileLayout ? "mobile" : "default"}
        showLoadoutOnMobile={isMobileLayout ? showLoadoutOnMobile : undefined}
        canEdit={canEdit}
        canManageItems={canManageItems}
        onToggle={() => editor.toggleExpanded(unit.id)}
      />
    );
  };

  return (
    <div className="space-y-4">
      {isMobileLayout ? (
        <div className="space-y-10">
          {units.map((unit) => (
            <div key={unit.id} className="space-y-5">
              {card(unit)}
            </div>
          ))}
        </div>
      ) : (
        <div className="warband-hero-grid">
          {units.map((unit) => (
            <div
              key={unit.id}
              className={`warband-hero-slot${visuallyExpandedId === unit.id ? " warband-hero-slot--expanded" : ""}`}
            >
              {card(unit)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
