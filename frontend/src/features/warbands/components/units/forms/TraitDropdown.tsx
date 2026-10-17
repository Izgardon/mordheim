import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Checkbox } from "@components/checkbox";
import { ActionSearchDropdown } from "@components/action-search-input";

type TraitDropdownProps = {
  options: string[];
  selected: string[];
  onSelect: (value: string) => void;
  multi?: boolean;
  placeholder?: string;
  searchable?: boolean;
};

export default function TraitDropdown({
  options,
  selected,
  onSelect,
  multi = false,
  placeholder = "Select...",
  searchable = false,
}: TraitDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const label = (() => {
    if (!selected.length) return <span className="text-muted-foreground">{placeholder}</span>;
    if (selected.length === 1) return selected[0];
    return (
      <>
        {selected[0]} <span className="text-muted-foreground">+{selected.length - 1}</span>
      </>
    );
  })();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-7 items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 text-[10px] text-foreground transition-colors hover:border-primary/60"
        onClick={() => setIsOpen((o) => !o)}
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      <ActionSearchDropdown open={isOpen} className="mt-1 w-48 rounded-xl">
        <div className="p-1">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="mb-1 w-full rounded-lg border border-border/60 bg-background/70 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          )}
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((option) =>
                multi ? (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent/25"
                  >
                    <Checkbox
                      checked={selected.includes(option)}
                      onChange={() => onSelect(option)}
                    />
                    {option}
                  </label>
                ) : (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(option);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-accent/25 ${
                      selected.includes(option) ? "text-accent font-semibold" : "text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                )
              )
            )}
          </div>
        </div>
      </ActionSearchDropdown>
    </div>
  );
}
