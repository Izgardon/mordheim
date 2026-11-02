import * as React from "react";
import { Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";

/** One row of a searchable select: a title, a muted subtitle, and a warning that greys it. */
export type SearchOption = {
  id: string | number;
  title: string;
  /** The muted line under the title: a skill's category, a spell's lore, an item's kind. */
  subtitle?: string;
  /** Greys the row with this line ("Khemri isn't in this campaign"); it stays pickable. */
  warning?: string;
  /** A caption the row sits under ("Your warband's"); rows of a group come together. */
  group?: string;
  /** More words a search matches (a race, a source code). */
  keywords?: string;
  /** Beside the title on the right: a grade, a price. */
  aside?: React.ReactNode;
  /** Before the title: what the entry is. */
  icon?: React.ReactNode;
};

const fold = (text: string) => text.trim().toLowerCase();

/** The options whose title, subtitle or keywords contain what was typed, in their given order. */
export function filterOptions(options: SearchOption[], typed: string) {
  const query = fold(typed);
  if (!query) return options;
  return options.filter((option) =>
    [option.title, option.subtitle ?? "", option.keywords ?? ""].some((text) =>
      fold(text).includes(query)
    )
  );
}

export type SearchComboboxProps = {
  options: SearchOption[];
  onPick: (option: SearchOption) => void;
  /** The input's name for a screen reader ("Add skill", "Race"). */
  label: string;
  placeholder?: string;
  /** The one row shown when nothing matches. */
  emptyText?: string;
  /** The list always shows under the input (a picker panel); otherwise it drops down on focus. */
  inline?: boolean;
  /** What was typed, added as a new entry when no option has that name. */
  create?: { label: (typed: string) => string; onCreate: (typed: string) => void };
  loading?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
  /** Escape with the list closed, or leaving the field: the caller puts its button back. */
  onDismiss?: () => void;
  /** At most this many rows; typing finds the rest. */
  limit?: number;
};

const CAPTION =
  "px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint first:pt-1.5";

/**
 * The searchable select's field and list (combobox and listbox roles): type to filter, arrows to
 * move, Enter to pick, Escape to close. `SearchSelect` and `SearchMultiSelect` hold a value on it.
 */
export function SearchCombobox(props: SearchComboboxProps) {
  const { options, onPick, inline = false, create, limit = 80, onDismiss } = props;
  const listId = React.useId();
  const [typed, setTyped] = React.useState("");
  const [open, setOpen] = React.useState(Boolean(props.autoFocus));
  const [active, setActive] = React.useState(0);
  const shown = filterOptions(options, typed).slice(0, limit);
  const name = typed.trim();
  const creating =
    create && name && !options.some((option) => fold(option.title) === fold(name)) ? name : "";
  const count = shown.length + (creating ? 1 : 0);
  const listOpen = inline || open;
  const current = Math.min(active, Math.max(0, count - 1));
  const rowId = (index: number) => `${listId}-${index}`;

  const activeId = listOpen && count ? rowId(current) : undefined;

  React.useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  const choose = (index: number) => {
    if (index < shown.length) onPick(shown[index]);
    else if (creating) create?.onCreate(creating);
    else return;
    setTyped("");
    setActive(0);
  };
  const move = (by: number) => {
    setOpen(true);
    setActive(count ? (current + by + count) % count : 0);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Enter" && listOpen && count) {
      event.preventDefault();
      choose(current);
    } else if (event.key === "Escape") {
      if (open && !inline) setOpen(false);
      else if (onDismiss) onDismiss();
      else return;
      event.preventDefault();
    }
  };

  let lastGroup: string | undefined;
  return (
    <div className={cn("relative flex min-w-0 flex-col", props.className)}>
      <label className="flex min-h-9 items-center gap-2 border border-strong bg-page px-2.5 text-muted-foreground focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          id={props.id}
          role="combobox"
          aria-label={props.label}
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoFocus={props.autoFocus}
          placeholder={props.placeholder ?? "Search"}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (!inline) onDismiss?.();
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-9 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint",
            props.inputClassName
          )}
        />
      </label>
      {listOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={props.label}
          className={cn(
            "m-0 flex max-h-72 list-none flex-col overflow-y-auto border border-t-0 border-strong bg-panel p-0",
            !inline &&
              "absolute left-0 right-0 top-full z-30 shadow-[0_16px_40px_var(--color-shadow)]"
          )}
        >
          {props.loading && !shown.length ? (
            <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">
              Loading…
            </li>
          ) : count === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-text2">
              {props.emptyText ?? "Nothing matches."}
            </li>
          ) : null}
          {shown.map((option, index) => {
            const caption = option.group && option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return (
              <React.Fragment key={option.id}>
                {caption ? (
                  <li role="presentation" className={CAPTION}>
                    {caption}
                  </li>
                ) : null}
                <li
                  id={rowId(index)}
                  role="option"
                  aria-selected={index === current}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 border-t border-line px-3 py-2 first:border-t-0",
                    index === current && "bg-raised"
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "flex min-w-0 items-center gap-1.5 text-sm font-semibold",
                        option.warning ? "text-text2" : "text-ink"
                      )}
                    >
                      {option.icon}
                      {option.title}
                    </span>
                    {option.aside}
                  </span>
                  {option.subtitle ? (
                    <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                  ) : null}
                  {option.warning ? (
                    <span className="text-xs font-semibold text-danger">{option.warning}</span>
                  ) : null}
                </li>
              </React.Fragment>
            );
          })}
          {creating ? (
            <li
              id={rowId(shown.length)}
              role="option"
              aria-selected={current === shown.length}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(shown.length)}
              onClick={() => choose(shown.length)}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-semibold text-accent-text",
                current === shown.length && "bg-raised"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              {create?.label(creating)}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
