import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import CreateRaceDialog from "../../../../races/components/CreateRaceDialog";

import type { Race } from "../../../../races/types/race-types";
import type { NewHenchmenGroupForm } from "../../../hooks/useHenchmenGroupCreationForm";

type AddHenchmenGroupFormProps = {
  campaignId: number;
  newGroupForm: NewHenchmenGroupForm;
  setNewGroupForm: Dispatch<SetStateAction<NewHenchmenGroupForm>>;
  newGroupError: string;
  setNewGroupError: (value: string) => void;
  raceQuery: string;
  setRaceQuery: (value: string) => void;
  isRaceDialogOpen: boolean;
  setIsRaceDialogOpen: (value: boolean) => void;
  matchingRaces: Race[];
  onAddGroup: () => void;
  onCancel: () => void;
  onRaceCreated: (race: Race) => void;
};

export default function AddHenchmenGroupForm({
  campaignId,
  newGroupForm,
  setNewGroupForm,
  newGroupError,
  setNewGroupError,
  raceQuery,
  setRaceQuery,
  isRaceDialogOpen,
  setIsRaceDialogOpen,
  matchingRaces,
  onAddGroup,
  onCancel,
  onRaceCreated,
}: AddHenchmenGroupFormProps) {
  const [isNewRaceListOpen, setIsNewRaceListOpen] = useState(false);
  const raceBlurTimeoutRef = useRef<number | null>(null);

  const handleRaceFocus = () => {
    if (raceBlurTimeoutRef.current !== null) {
      window.clearTimeout(raceBlurTimeoutRef.current);
      raceBlurTimeoutRef.current = null;
    }
    setIsNewRaceListOpen(true);
  };

  const handleRaceBlur = () => {
    raceBlurTimeoutRef.current = window.setTimeout(() => {
      setIsNewRaceListOpen(false);
    }, 120);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-foreground shadow-[0_16px_32px_rgba(5,20,24,0.3)]">
      <CreateRaceDialog
        campaignId={campaignId}
        onCreated={(race) => {
          onRaceCreated(race);
          setNewGroupForm((prev) => ({ ...prev, race_id: race.id, race_name: race.name }));
          setRaceQuery(race.name);
          setNewGroupError("");
        }}
        open={isRaceDialogOpen}
        onOpenChange={setIsRaceDialogOpen}
        trigger={null}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onAddGroup}>Create group</Button>
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[160px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Group name</Label>
          <Input
            value={newGroupForm.name}
            onChange={(e) => { setNewGroupForm((prev) => ({ ...prev, name: e.target.value })); setNewGroupError(""); }}
            placeholder="Group name"
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Type</Label>
          <Input
            value={newGroupForm.unit_type}
            onChange={(e) => { setNewGroupForm((prev) => ({ ...prev, unit_type: e.target.value })); setNewGroupError(""); }}
            placeholder="Warrior, Zombie"
          />
        </div>
        <div className="min-w-[200px] flex-[1.2] space-y-2">
          <Label className="text-sm font-semibold text-foreground">Race</Label>
          <div className="relative">
            <ActionSearchInput
              value={raceQuery}
              onChange={(e) => {
                setRaceQuery(e.target.value);
                setNewGroupForm((prev) => ({ ...prev, race_id: null, race_name: "" }));
                setNewGroupError("");
              }}
              placeholder="Search races..."
              onFocus={handleRaceFocus}
              onBlur={handleRaceBlur}
              actionLabel="Create"
              actionAriaLabel="Create race"
              actionClassName="border-border/60 bg-background/70 text-foreground hover:border-primary/60"
              onAction={() => setIsRaceDialogOpen(true)}
            />
            <ActionSearchDropdown open={isNewRaceListOpen} className="mt-1 rounded-xl">
              <div className="max-h-40 w-full overflow-y-auto p-1">
                {matchingRaces.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No matches yet.</p>
                ) : (
                  <div className="space-y-1">
                    {matchingRaces.map((race) => (
                      <button
                        key={race.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setNewGroupForm((prev) => ({ ...prev, race_id: race.id, race_name: race.name }));
                          setRaceQuery(race.name);
                          setNewGroupError("");
                          setIsNewRaceListOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/60 hover:bg-accent/25"
                      >
                        <span className="font-semibold">{race.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ActionSearchDropdown>
          </div>
        </div>
        <div className="min-w-[160px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">First henchman</Label>
          <Input
            value={newGroupForm.firstHenchmanName}
            onChange={(e) => { setNewGroupForm((prev) => ({ ...prev, firstHenchmanName: e.target.value })); setNewGroupError(""); }}
            placeholder="Henchman name"
          />
        </div>
        <div className="min-w-[120px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Max size</Label>
          <NumberInput
            min={1}
            value={newGroupForm.max_size}
            onChange={(e) => setNewGroupForm((prev) => ({ ...prev, max_size: e.target.value }))}
            placeholder="5"
          />
        </div>
        <div className="min-w-[100px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Cost</Label>
          <NumberInput
            min={0}
            value={newGroupForm.price}
            onChange={(e) => setNewGroupForm((prev) => ({ ...prev, price: e.target.value }))}
            placeholder="0"
          />
        </div>
      </div>
      {newGroupError ? <p className="text-sm text-red-600">{newGroupError}</p> : null}
    </div>
  );
}
