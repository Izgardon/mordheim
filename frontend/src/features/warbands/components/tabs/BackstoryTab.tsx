import { Button } from "../../../../components/ui/button";
import { CardBackground } from "@components/card-background";

import { useBackstory } from "../../hooks/warband/useBackstory";

import type { Warband } from "../../types/warband-types";

type BackstoryTabProps = {
  warband: Warband;
  isWarbandOwner: boolean;
  onWarbandUpdated: (warband: Warband) => void;
};

export default function BackstoryTab({
  warband,
  isWarbandOwner,
  onWarbandUpdated,
}: BackstoryTabProps) {
  const {
    backstoryDraft,
    setBackstoryDraft,
    isEditingBackstory,
    isSavingBackstory,
    backstoryError,
    backstoryMessage,
    handleSaveBackstory,
    startEditing,
    cancelEditing,
  } = useBackstory({ warband, isWarbandOwner, onWarbandUpdated });

  const warbandName = warband.name || "this warband";

  return (
    <div className="space-y-4">
      <CardBackground className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="flex flex-wrap items-baseline gap-2 text-foreground">
            <span className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              The story of
            </span>
            <span className="text-2xl font-semibold">{warbandName}</span>
          </h2>
        </div>
        {isWarbandOwner ? (
          <div className="flex items-center gap-2">
            {isEditingBackstory ? (
              <>
                <Button
                  variant="secondary"
                  onClick={cancelEditing}
                  disabled={isSavingBackstory}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveBackstory} disabled={isSavingBackstory}>
                  {isSavingBackstory ? "Saving..." : "Save backstory"}
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={startEditing}
              >
                Edit backstory
              </Button>
            )}
          </div>
        ) : null}
      </CardBackground>

      {isEditingBackstory ? (
        <textarea
          value={backstoryDraft}
          onChange={(event) => setBackstoryDraft(event.target.value)}
          placeholder="Share the tale of your warband..."
          className="min-h-[220px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
        />
      ) : warband.backstory ? (
        <div className="space-y-3 text-sm text-foreground/90">
          {warband.backstory.split("\n").map((line, index) =>
            line.trim() ? <p key={index}>{line}</p> : <br key={index} />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No backstory recorded yet.</p>
      )}

      {backstoryMessage ? <p className="text-sm text-emerald-400">{backstoryMessage}</p> : null}
      {backstoryError ? <p className="text-sm text-red-600">{backstoryError}</p> : null}
    </div>
  );
}
