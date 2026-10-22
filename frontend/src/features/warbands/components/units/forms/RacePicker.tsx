import { useRef, useState, type KeyboardEvent } from "react";
import { Command } from "cmdk";
import { Plus } from "lucide-react";

import { Button } from "@components/button";
import { Input } from "@components/input";
import CreateRaceDialog from "@/features/races/components/CreateRaceDialog";
import { cn } from "@/lib/utils";
import { useCanAddCustom } from "../catalogue-context";

import type { Race } from "@/features/races/types/race-types";

type RacePickerProps = {
  /** "add": the add-unit forms; "edit": the edit cards (a tighter list). */
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

const inputClasses =
  "pr-14 !border-border/60 !bg-background/70 text-foreground placeholder:text-muted-foreground focus-visible:!ring-[#9a7a45] min-[960px]:!border-[#4a3829] min-[960px]:!bg-black";
const actionClasses =
  "absolute right-0 top-0 flex h-full min-w-0 aspect-square items-center justify-center rounded-sm border border-border/60 bg-background/70 p-0 text-[color:var(--color-icon-soft)] shadow-none hover:bg-background/80 hover:translate-y-0 active:translate-y-0 min-[960px]:border-[#4a3829] min-[960px]:bg-black min-[960px]:hover:bg-[#120e0a] [&_svg]:h-4 [&_svg]:w-4";

/**
 * The race search with "Create race", shared by every unit form. A cmdk combobox (UX-02): the
 * arrow keys move through the matches, Enter picks one and Escape closes the list.
 */
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
  // Creating a race needs edit_catalogue, as every catalogue create does (BUG-82).
  const canCreate = useCanAddCustom();
  const blurTimeoutRef = useRef<number | null>(null);
  const trimmed = query.trim().toLowerCase();
  const matchingRaces = races.filter(
    (race) => race.id !== selectedRaceId && (!trimmed || race.name.toLowerCase().includes(trimmed))
  );

  const handleType = (value: string) => {
    setQuery(value);
    onType();
    setIsListOpen(true);
  };
  const handleSelect = (race: Race) => {
    onSelect(race);
    setQuery(race.name);
    setIsListOpen(false);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && isListOpen) {
      event.stopPropagation();
      setIsListOpen(false);
    } else if (event.key === "ArrowDown" && !isListOpen) {
      setIsListOpen(true);
    }
  };

  return (
    <>
      {canCreate ? (
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
      ) : null}
      <Command shouldFilter={false} loop label="Race" className="relative">
        <div className="relative">
          <Command.Input asChild value={query} onValueChange={handleType}>
            <Input
              type="text"
              autoComplete="off"
              placeholder="Search races..."
              className={cn(inputClasses, inputClassName)}
              onKeyDown={handleKeyDown}
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
            />
          </Command.Input>
          {canCreate ? (
            <Button
              type="button"
              aria-label="Create race"
              className={actionClasses}
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {isListOpen ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#4a3829]/55 bg-[#120e0a] shadow-[0_18px_32px_rgba(6,4,2,0.32)]">
            <Command.List
              className={cn(
                "w-full overflow-y-auto p-1",
                variant === "add" ? "max-h-40" : "max-h-60"
              )}
            >
              <Command.Empty className="px-3 py-2 text-xs text-muted-foreground">
                No matches yet.
              </Command.Empty>
              {matchingRaces.map((race) => (
                <Command.Item
                  key={race.id}
                  value={String(race.id)}
                  onSelect={() => handleSelect(race)}
                  onMouseDown={(event) => event.preventDefault()}
                  className="flex w-full cursor-pointer items-center rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-foreground data-[selected=true]:bg-accent/25 data-[selected=true]:text-[color:var(--color-icon-strong)]"
                >
                  {race.name}
                </Command.Item>
              ))}
            </Command.List>
          </div>
        ) : null}
      </Command>
    </>
  );
}
