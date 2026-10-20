import PrebattleCustomUnitBuilder from "@/features/battles/components/prebattle/PrebattleCustomUnitBuilder";
import type { CustomUnitDraftState } from "@/features/battles/hooks/useCustomUnitDraft";

/** Under your own warband in battle: the saving line, the last error and Add Temporary Unit. */
export default function ActiveOwnTools({
  campaignId,
  isSaving,
  error,
  customUnitDraft,
  onAddCustomUnit,
}: {
  campaignId: number;
  isSaving: boolean;
  error: string;
  customUnitDraft: CustomUnitDraftState;
  onAddCustomUnit: () => void;
}) {
  return (
    <>
      {isSaving ? (
        <p className="text-[0.58rem] uppercase tracking-[0.2em] text-muted-foreground">
          Saving unit config...
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <PrebattleCustomUnitBuilder
        open={customUnitDraft.isOpen}
        draft={customUnitDraft.draft}
        error={customUnitDraft.error}
        showRatingField={false}
        campaignId={campaignId}
        onToggleOpen={customUnitDraft.toggleOpen}
        onDraftChange={customUnitDraft.changeDraft}
        onDraftStatChange={customUnitDraft.changeStat}
        onSave={onAddCustomUnit}
      />
    </>
  );
}
