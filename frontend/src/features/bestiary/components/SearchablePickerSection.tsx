import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

type Identifiable = { id: number; name: string; description?: string };

type Props<T extends Identifiable> = {
  label: string;
  placeholder: string;
  items: T[];
  selected: T[];
  onSelect: (item: T) => void;
  onRemove: (id: number) => void;
  /** Render extra content after each selected tag (e.g. quantity input) */
  renderSelectedExtra?: (item: T) => React.ReactNode;
  /** If provided, shows a "create new" button at the bottom of the list */
  onCreateNew?: (searchText: string) => void;
  createNewLabel?: string;
};

export default function SearchablePickerSection<T extends Identifiable>({
  label,
  placeholder,
  items,
  selected,
  onSelect,
  onRemove,
  renderSelectedExtra,
  onCreateNew,
  createNewLabel = "Create new",
}: Props<T>) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  const filtered = useMemo(() => {
    const selectedIds = new Set(selected.map((s) => s.id));
    const q = search.trim().toLowerCase();
    return items
      .filter((s) => !selectedIds.has(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, selected, search]);

  const handleSelect = useCallback(
    (item: T) => {
      onSelect(item);
      setSearch("");
    },
    [onSelect],
  );

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <Label>{label}</Label>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
            >
              {s.name}
              {renderSelectedExtra?.(s)}
              <button
                type="button"
                onClick={() => onRemove(s.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${s.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (!expanded) setExpanded(true);
        }}
        onFocus={() => setExpanded(true)}
        placeholder={placeholder}
      />
      {expanded ? (
        <div className="max-h-40 overflow-y-auto rounded-md border border-input bg-popover">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
            >
              <span>{s.name}</span>
              {s.description ? (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {s.description}
                </span>
              ) : null}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No matches
            </p>
          ) : null}
          {onCreateNew ? (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 border-t border-border/60 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onCreateNew(search.trim());
                setExpanded(false);
                setSearch("");
              }}
            >
              + {createNewLabel}
              {search.trim() ? ` "${search.trim()}"` : ""}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
