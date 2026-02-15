import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import CreateRaceDialog from "@/features/races/components/CreateRaceDialog";

import type { Race } from "@/features/races/types/race-types";
import type { NewHiredSwordForm as NewHiredSwordFormType } from "@/features/warbands/utils/warband-utils";

type AddHiredSwordFormProps = {
  campaignId: number;
  newHiredSwordForm: NewHiredSwordFormType;
  setNewHiredSwordForm: Dispatch<SetStateAction<NewHiredSwordFormType>>;
  newHiredSwordError: string;
  setNewHiredSwordError: (value: string) => void;
  raceQuery: string;
  setRaceQuery: (value: string) => void;
  isRaceDialogOpen: boolean;
  setIsRaceDialogOpen: (value: boolean) => void;
  matchingRaces: Race[];
  onAddHiredSword: () => void;
  isHiredSwordLimitReached: boolean;
  maxHiredSwords: number;
  onCancel: () => void;
  onRaceCreated: (race: Race) => void;
};

export default function AddHiredSwordForm({
  campaignId,
  newHiredSwordForm,
  setNewHiredSwordForm,
  newHiredSwordError,
  setNewHiredSwordError,
  raceQuery,
  setRaceQuery,
  isRaceDialogOpen,
  setIsRaceDialogOpen,
  matchingRaces,
  onAddHiredSword,
  isHiredSwordLimitReached,
  maxHiredSwords,
  onCancel,
  onRaceCreated,
}: AddHiredSwordFormProps) {
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
          setNewHiredSwordForm((prev) => ({
            ...prev,
            race_id: race.id,
            race_name: race.name,
          }));
          setRaceQuery(race.name);
          setNewHiredSwordError("");
        }}
        open={isRaceDialogOpen}
        onOpenChange={setIsRaceDialogOpen}
        trigger={null}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={onAddHiredSword}>
            Create hired sword
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Name</Label>
          <Input
            value={newHiredSwordForm.name}
            onChange={(event) => {
              setNewHiredSwordForm((prev) => ({
                ...prev,
                name: event.target.value,
              }));
              setNewHiredSwordError("");
            }}
            placeholder="Hired sword name"
          />
        </div>
        <div className="min-w-[160px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Type</Label>
          <Input
            value={newHiredSwordForm.unit_type}
            onChange={(event) => {
              setNewHiredSwordForm((prev) => ({
                ...prev,
                unit_type: event.target.value,
              }));
              setNewHiredSwordError("");
            }}
            placeholder="Hired Sword"
          />
        </div>
        <div className="min-w-[200px] flex-[1.2] space-y-2">
          <Label className="text-sm font-semibold text-foreground">Race</Label>
          <div className="relative">
            <ActionSearchInput
              value={raceQuery}
              onChange={(event) => {
                const value = event.target.value;
                setRaceQuery(value);
                setNewHiredSwordForm((prev) => ({
                  ...prev,
                  race_id: null,
                  race_name: "",
                }));
                setNewHiredSwordError("");
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
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No matches yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {matchingRaces.map((race) => (
                      <button
                        key={race.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setNewHiredSwordForm((prev) => ({
                            ...prev,
                            race_id: race.id,
                            race_name: race.name,
                          }));
                          setRaceQuery(race.name);
                          setNewHiredSwordError("");
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
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Hire price</Label>
          <NumberInput
            min={0}
            value={newHiredSwordForm.price}
            onChange={(event) =>
              setNewHiredSwordForm((prev) => ({
                ...prev,
                price: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Upkeep price</Label>
          <NumberInput
            min={0}
            value={newHiredSwordForm.upkeep_price}
            onChange={(event) =>
              setNewHiredSwordForm((prev) => ({
                ...prev,
                upkeep_price: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Rating</Label>
          <NumberInput
            min={0}
            value={newHiredSwordForm.rating}
            onChange={(event) =>
              setNewHiredSwordForm((prev) => ({
                ...prev,
                rating: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
      </div>
      {newHiredSwordError ? <p className="text-sm text-red-600">{newHiredSwordError}</p> : null}
      {isHiredSwordLimitReached ? (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxHiredSwords} hired swords reached.
        </p>
      ) : null}
    </div>
  );
}
