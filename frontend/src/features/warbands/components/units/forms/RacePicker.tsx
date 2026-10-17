import { useRef, useState } from "react";

import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import CreateRaceDialog from "@/features/races/components/CreateRaceDialog";
import SearchableDropdown from "../../shared/forms/SearchableDropdown";

import type { Race } from "@/features/races/types/race-types";

type RacePickerProps = {
  /** "add": the add-unit forms' search input; "edit": the edit cards' searchable dropdown. */
  variant: "add" | "edit";
  campaignId: number;
  races: Race[];
  /** The current race, left out of the matches. */
  selectedRaceId: number | null;
  query: string;
  setQuery: (value: string) => void;
  /** Typing in the box: the caller clears the chosen race. */
  onType: () => void;
  onSelect: (race: Race) => void;
  /** A race made in the "Create race" dialog: the caller registers and picks it. */
  onCreated: (race: Race) => void;
  inputClassName?: string;
};

/** The race search with "Create race", shared by every unit form (replaces five copies). */
export default function RacePicker({
  variant,
  campaignId,
  races,
  selectedRaceId,
  query,
  setQuery,
  onType,
  onSelect,
  onCreated,
  inputClassName = "",
}: RacePickerProps) {
  const [isListOpen, setIsListOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const trimmed = query.trim().toLowerCase();
  const matchingRaces = races.filter(
    (race) => race.id !== selectedRaceId && (!trimmed || race.name.toLowerCase().includes(trimmed))
  );

  const handleType = (value: string) => {
    setQuery(value);
    onType();
  };
  const handleSelect = (race: Race) => {
    onSelect(race);
    setQuery(race.name);
    setIsListOpen(false);
  };

  const createDialog = (
    <CreateRaceDialog
      campaignId={campaignId}
      onCreated={(race) => {
        onCreated(race);
        setQuery(race.name);
      }}
      open={isCreateOpen}
      onOpenChange={setIsCreateOpen}
      trigger={null}
    />
  );

  if (variant === "edit") {
    return (
      <>
        {createDialog}
        <SearchableDropdown
          query={query}
          onQueryChange={handleType}
          placeholder="Search races..."
          inputClassName={inputClassName}
          items={matchingRaces}
          isOpen={isListOpen}
          onFocus={() => setIsListOpen(true)}
          onBlur={() => setIsListOpen(false)}
          onSelectItem={handleSelect}
          renderItem={(race) => <span className="font-semibold">{race.name}</span>}
          getItemKey={(race) => race.id}
          canCreate
          onCreateClick={() => setIsCreateOpen(true)}
          createLabel="Create"
        />
      </>
    );
  }

  return (
    <>
      {createDialog}
      <div className="relative">
        <ActionSearchInput
          value={query}
          onChange={(event) => handleType(event.target.value)}
          placeholder="Search races..."
          onFocus={() => {
            if (blurTimeoutRef.current !== null) {
              window.clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
            setIsListOpen(true);
          }}
          onBlur={() => {
            blurTimeoutRef.current = window.setTimeout(() => setIsListOpen(false), 120);
          }}
          actionLabel="Create"
          actionAriaLabel="Create race"
          actionClassName="border-border/60 bg-background/70 text-foreground hover:border-primary/60"
          onAction={() => setIsCreateOpen(true)}
        />
        <ActionSearchDropdown open={isListOpen} className="mt-1 rounded-xl">
          <div className="max-h-40 w-full overflow-y-auto p-1">
            {matchingRaces.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No matches yet.</p>
            ) : (
              <div className="space-y-1">
                {matchingRaces.map((race) => (
                  <button
                    key={race.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(race)}
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
    </>
  );
}
