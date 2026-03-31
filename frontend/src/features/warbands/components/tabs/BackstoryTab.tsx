import { Pencil } from "lucide-react";
import { Button } from "../../../../components/ui/button";

import { useBackstory } from "../../hooks/warband/useBackstory";

import type { Warband } from "../../types/warband-types";

type BackstoryTabProps = {
  warband: Warband;
  isWarbandOwner: boolean;
  isMobile?: boolean;
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
    <div className="surface-panel-strong relative rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-baseline gap-2 text-foreground">
            <span className="text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              The story of
            </span>
            <span className="text-2xl font-semibold">{warbandName}</span>
          </h2>
        </div>
        {isWarbandOwner ? (
          <div className="flex items-center justify-end gap-2">
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
              <button
                type="button"
                aria-label="Edit backstory"
                onClick={startEditing}
                className="icon-button flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <Pencil className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : null}
      </div>

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
