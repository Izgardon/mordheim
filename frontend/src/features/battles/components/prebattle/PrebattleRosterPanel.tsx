import { CardBackground } from "@/components/ui/card-background";
import PrebattleCustomUnitBuilder from "@/features/battles/components/prebattle/PrebattleCustomUnitBuilder";
import PrebattleParticipantRoster from "@/features/battles/components/prebattle/PrebattleParticipantRoster";
import type {
  ParticipantRoster,
  PrebattleUnit,
  UnitOverride,
  UnitSingleUseItem,
} from "@/features/battles/components/prebattle/prebattle-types";
import { participantStatusLabel } from "@/features/battles/components/prebattle/prebattle-utils";
import type { PrebattleConfig } from "@/features/battles/hooks/usePrebattleConfig";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type PrebattleRosterPanelProps = {
  campaignId: number;
  participant: BattleParticipant | null;
  isOwn: boolean;
  editable: boolean;
  isRosterLoading: boolean;
  roster: ParticipantRoster | undefined;
  rosterLoading: boolean;
  rosterError: string | undefined;
  visible: {
    customUnits: PrebattleUnit[];
    selectedKeys: string[];
    overrides: Record<string, UnitOverride>;
    notes: Record<string, string>;
  };
  ratingInputValue: string;
  onRatingInputChange: (value: string) => void;
  config: PrebattleConfig;
  onAddCustomUnit: () => void;
  getUsedSingleUseItemCount: (unitKey: string, itemId: number) => number;
  activeItemActionKey: string | null;
  onUseSingleUseItem: (unit: PrebattleUnit, item: UnitSingleUseItem) => void;
  sectionIds: Parameters<typeof PrebattleParticipantRoster>[0]["sectionIds"];
};

/** The selected warband in prebattle: its units, and the temporary-unit form for your own. */
export default function PrebattleRosterPanel({
  campaignId,
  participant,
  isOwn,
  editable,
  isRosterLoading,
  roster,
  rosterLoading,
  rosterError,
  visible,
  ratingInputValue,
  onRatingInputChange,
  config,
  onAddCustomUnit,
  getUsedSingleUseItemCount,
  activeItemActionKey,
  onUseSingleUseItem,
  sectionIds,
}: PrebattleRosterPanelProps) {
  const { customUnitDraft } = config;
  return (
    <>
      {isRosterLoading ? (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Loading units...</p>
        </CardBackground>
      ) : null}
      {participant ? (
        isRosterLoading ? null : (
          <PrebattleParticipantRoster
            participant={participant}
            participantStatusLabel={participantStatusLabel(participant.status)}
            editable={editable}
            ratingInputValue={ratingInputValue}
            onRatingInputChange={onRatingInputChange}
            participantRoster={roster}
            rosterLoading={rosterLoading}
            rosterError={rosterError}
            participantSelectedKeys={visible.selectedKeys}
            participantOverrides={visible.overrides}
            participantNotes={visible.notes}
            participantCustomUnits={visible.customUnits}
            selectedUnitKeys={config.selectedUnitKeys}
            editingUnitKey={config.editingUnitKey}
            onToggleUnitSelection={config.toggleUnitSelection}
            onToggleEditingUnit={config.toggleEditingUnit}
            onUpdateOverrideStat={config.updateOverrideStat}
            onUpdateUnitNotes={config.updateUnitNotes}
            onClearUnitOverride={config.clearUnitOverride}
            onRemoveCustomUnit={config.removeCustomUnit}
            canUseItems={editable}
            onUseSingleUseItem={onUseSingleUseItem}
            getUsedSingleUseItemCount={getUsedSingleUseItemCount}
            activeItemActionKey={activeItemActionKey}
            sectionIds={sectionIds}
          />
        )
      ) : (
        <CardBackground className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">No warbands available yet.</p>
        </CardBackground>
      )}

      {isOwn && !isRosterLoading ? (
        <PrebattleCustomUnitBuilder
          open={customUnitDraft.isOpen}
          draft={customUnitDraft.draft}
          error={customUnitDraft.error}
          disabled={!editable}
          campaignId={campaignId}
          onToggleOpen={customUnitDraft.toggleOpen}
          onDraftChange={customUnitDraft.changeDraft}
          onDraftStatChange={customUnitDraft.changeStat}
          onSave={onAddCustomUnit}
        />
      ) : null}
    </>
  );
}
