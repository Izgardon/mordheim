import { Button } from "@components/button";
import WarbandSectionShell from "../shared/sections/WarbandSectionShell";
import UnitSectionEditing from "./section/UnitSectionEditing";
import UnitSectionRoster from "./section/UnitSectionRoster";
import { useWarbandCatalogue } from "./catalogue-context";
import { useSectionExpansion } from "../../hooks/units/useSectionExpansion";

import type { UnitSectionEditor } from "../../hooks/units/useUnitSectionEditor";
import type { Unit, UnitKindKey } from "../../types/units";

type UnitSectionProps<K extends UnitKindKey> = {
  editor: UnitSectionEditor<K>;
  units: Unit<K>[];
  warbandId: number;
  /** `edit`: Edit, XP +/-, the trading action and pending skill and spell picks. */
  canEdit: boolean;
  /** `level_up`: the Level Up! control (defaults to canEdit; the server grants them together). */
  canLevelUp?: boolean;
  /** `manage_items`: the item menus (defaults to canEdit). */
  canManageItems?: boolean;
  layoutVariant?: "default" | "mobile";
  actionsHidden?: boolean;
  levelThresholds?: readonly number[];
  availableGold: number;
  showLoadoutOnMobile?: boolean;
};

/** A roster section (Heroes, Henchmen, Hired Swords): its cards, or its edit forms. */
export default function UnitSection<K extends UnitKindKey>({
  editor,
  units,
  warbandId,
  canEdit,
  canLevelUp = canEdit,
  canManageItems = canEdit,
  layoutVariant = "default",
  actionsHidden = false,
  levelThresholds,
  availableGold,
  showLoadoutOnMobile = false,
}: UnitSectionProps<K>) {
  const catalogue = useWarbandCatalogue();
  const { kind, isEditing, save, purchases } = editor;
  const isMobileLayout = layoutVariant === "mobile";
  const { visuallyExpandedId, sectionRef } = useSectionExpansion(editor.forms.expandedId, {
    scrollIntoView: kind.flags.scrollsIntoViewOnExpand,
    isMobileLayout,
  });

  const status = (loading: boolean, label: string, error: string) => (
    <>
      {loading ? <p className="text-xs text-muted-foreground">Loading {label}...</p> : null}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </>
  );
  const statusNode = isEditing ? (
    <>
      {status(catalogue.isItemsLoading, "items", catalogue.itemsError)}
      {status(catalogue.isSkillsLoading, "skills", catalogue.skillsError)}
      {kind.flags.hasSpells
        ? status(catalogue.isSpellsLoading, "spells", catalogue.spellsError)
        : null}
      {status(catalogue.isSpecialsLoading, "specials", catalogue.specialsError)}
      {status(catalogue.isRacesLoading, "races", catalogue.racesError)}
    </>
  ) : null;
  // Shown in and out of an edit: the batch went through, a later write didn't.
  const followUpNode = save.followUpNotice ? (
    <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-red-600">
      <span>{save.followUpNotice}</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => void save.retryFollowUps()}
        disabled={save.isRetryingFollowUps}
      >
        {save.isRetryingFollowUps ? "Retrying..." : "Retry"}
      </Button>
    </div>
  ) : null;

  return (
    <div ref={sectionRef}>
      <WarbandSectionShell
        title={kind.labels.plural}
        titleSuffix={editor.limits.titleSuffix}
        isEditing={isEditing}
        canEdit={canEdit}
        variant={isMobileLayout ? "plain" : "card"}
        className={isMobileLayout ? "px-0" : undefined}
        headerClassName={isMobileLayout ? "gap-2" : undefined}
        actionsHidden={actionsHidden}
        editLabel={kind.labels.edit}
        onEdit={editor.startEditing}
        onCancel={editor.requestCancel}
        onSave={save.handleSaveChanges}
        isSaving={save.isSaving}
        status={
          <>
            {statusNode}
            {followUpNode}
          </>
        }
        saveError={save.saveError}
        pendingSpend={purchases.pendingSpend}
        pendingChanges={purchases.pendingChanges}
        availableGold={availableGold}
      >
        {isEditing ? (
          <UnitSectionEditing editor={editor} />
        ) : units.length === 0 ? (
          <p className="text-sm text-muted-foreground">{kind.labels.empty}</p>
        ) : (
          <UnitSectionRoster
            editor={editor}
            units={units}
            warbandId={warbandId}
            canEdit={canEdit}
            canLevelUp={canLevelUp}
            canManageItems={canManageItems}
            isMobileLayout={isMobileLayout}
            visuallyExpandedId={visuallyExpandedId}
            availableSpells={catalogue.availableSpells}
            levelThresholds={levelThresholds}
            showLoadoutOnMobile={showLoadoutOnMobile}
          />
        )}
      </WarbandSectionShell>
    </div>
  );
}
