import type { ReactNode } from "react";

import { Button } from "@components/button";
import SearchableDropdown from "../../../shared/forms/SearchableDropdown";

type AssignedEntry = { id: number; name: string; type?: string | null };

type AssignedEntriesProps<T extends AssignedEntry> = {
  /** "Assigned items", "Assigned skills", ... */
  title: string;
  entries: T[];
  emptyMessage: string;
  gridClassName: string;
  /** Items always show their type line; skills and specials only when they have one. */
  alwaysShowType?: boolean;
  onRemove: (index: number) => void;
  isAdding: boolean;
  onStartAdding: () => void;
  onStopAdding: () => void;
  addLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder: string;
  searchInputClassName: string;
  matches: T[];
  onSelect: (entry: T) => void;
  renderMatch: (entry: T) => ReactNode;
  canCreate: boolean;
  onCreateClick: () => void;
};

/** One tab of the group's loadout: the assigned entries and the search to add one. */
export default function AssignedEntries<T extends AssignedEntry>({
  title,
  entries,
  emptyMessage,
  gridClassName,
  alwaysShowType = false,
  onRemove,
  isAdding,
  onStartAdding,
  onStopAdding,
  addLabel,
  query,
  onQueryChange,
  searchPlaceholder,
  searchInputClassName,
  matches,
  onSelect,
  renderMatch,
  canCreate,
  onCreateClick,
}: AssignedEntriesProps<T>) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{title}</p>
        <span className="text-xs text-muted-foreground">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className={gridClassName}>
          {entries.map((entry, entryIndex) => (
            <div
              key={`${entry.id}-${entryIndex}`}
              className="group rounded-md border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold leading-tight">{entry.name}</p>
                  {alwaysShowType || entry.type ? (
                    <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                      {entry.type}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                  onClick={() => onRemove(entryIndex)}
                >
                  x
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {isAdding ? (
        <div className="relative">
          <SearchableDropdown
            query={query}
            onQueryChange={onQueryChange}
            placeholder={searchPlaceholder}
            inputClassName={searchInputClassName}
            items={matches}
            isOpen={true}
            autoFocusInput
            onBlur={onStopAdding}
            onSelectItem={onSelect}
            renderItem={renderMatch}
            getItemKey={(entry) => entry.id}
            canCreate={canCreate}
            onCreateClick={onCreateClick}
            createLabel="Create"
          />
        </div>
      ) : (
        <Button type="button" size="sm" onClick={onStartAdding}>
          {addLabel}
        </Button>
      )}
    </>
  );
}
