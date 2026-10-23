import type { MouseEvent } from "react";

import BeastItemButton from "./beasts/BeastItemButton";
import { CompanionEntryFrom, CompanionEntryMark } from "./beasts/CompanionEntryMark";

import type { LoadoutEntry } from "./loadout-blocks";

type LoadoutEntryRowProps = {
  entry: LoadoutEntry;
  /** Henchmen: the member count items must divide by (null for the other kinds). */
  memberCount: number | null;
  canEdit: boolean;
  onClick: (event: MouseEvent) => void;
  onMenuClick: (event: MouseEvent) => void;
  /** An Animal item's button (switch a mount or pet, recruit a creature); none: no button. */
  onBeastClick?: (event: MouseEvent) => void;
  /** Its request is on its way. */
  beastBusy?: boolean;
};

const ENTRY_CLASS = "unit-list-entry flex items-start gap-1 rounded px-1.5 py-0.5";
const BUTTON_CLASS =
  "unit-list-entry-button min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit transition-colors duration-150";

/** One loadout entry: a roster member, or an item/skill/spell/special with its menu and DC. */
export default function LoadoutEntryRow({
  entry,
  memberCount,
  canEdit,
  onClick,
  onMenuClick,
  onBeastClick,
  beastBusy = false,
}: LoadoutEntryRowProps) {
  if (entry.type === "roster") {
    return (
      <div
        className={`unit-list-entry flex min-h-[26px] items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
          entry.dead ? "unit-list-entry--dead line-through" : ""
        }`}
      >
        <span className="min-w-0 truncate">{entry.label}</span>
        <span className="unit-list-entry-meta shrink-0">{entry.kills} kills</span>
      </div>
    );
  }

  const isMember = memberCount !== null;
  const isItemMismatch =
    isMember && entry.type === "item" && memberCount > 0 && (entry.count ?? 0) % memberCount !== 0;
  const entryClassName = isMember
    ? `${ENTRY_CLASS} transition-colors duration-150 ${isItemMismatch ? "unit-list-entry--alert" : ""}`
    : entry.pending
      ? "unit-list-entry unit-list-entry--pending flex items-start gap-1 rounded px-1.5 py-0.5 transition-colors duration-150"
      : `${ENTRY_CLASS} transition-colors duration-150`;
  // A switched-on row is named apart from the same item's spare row for screen readers.
  const state = entry.beast?.on ? (entry.beast.kind === "mount" ? "ridden" : "kept as a pet") : "";
  const buttonClassName = entry.pending
    ? BUTTON_CLASS.replace(
        "unit-list-entry-button",
        "unit-list-entry-button unit-list-entry-button--pending"
      )
    : BUTTON_CLASS;

  const { companion } = entry;

  return (
    <div className={entryClassName}>
      <button type="button" className={buttonClassName} onClick={onClick}>
        {entry.label}
        {state ? <span className="sr-only"> ({state})</span> : null}
        {companion ? <CompanionEntryFrom {...companion} /> : null}
      </button>
      {entry.type === "spell" && entry.dc !== undefined && entry.dc !== null && entry.dc !== "" ? (
        <span className="unit-list-entry-meta whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em]">
          DC {entry.dc}
        </span>
      ) : null}
      {companion ? <CompanionEntryMark {...companion} /> : null}
      {entry.beast && canEdit && onBeastClick ? (
        <BeastItemButton
          kind={entry.beast.kind}
          on={entry.beast.on}
          itemLabel={entry.label}
          disabled={beastBusy}
          onClick={onBeastClick}
        />
      ) : null}
      {entry.type === "item" && canEdit && (
        <button
          type="button"
          className="unit-list-entry-menu flex h-5 w-4 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-colors duration-150"
          onClick={onMenuClick}
          aria-label={`Actions for ${entry.label}${state ? ` (${state})` : ""}`}
        >
          <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor" aria-hidden="true">
            <circle cx="1.5" cy="1.5" r="1.5" />
            <circle cx="1.5" cy="6.5" r="1.5" />
            <circle cx="1.5" cy="11.5" r="1.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
