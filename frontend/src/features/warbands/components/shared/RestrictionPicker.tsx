import { useMemo, useState } from "react";

import { Input } from "@components/input";

import type { Restriction } from "../../../items/types/item-types";

const TYPE_ORDER = ["Setting", "Warband Group", "Warband"] as const;

type RestrictionPickerProps = {
  restrictions: Restriction[];
  selected: Set<number>;
  onToggle: (restriction: Restriction) => void;
};

export default function RestrictionPicker({
  restrictions,
  selected,
  onToggle,
}: RestrictionPickerProps) {
  const [filter, setFilter] = useState("");

  const grouped = useMemo(() => {
    const lowerFilter = filter.toLowerCase();
    const filtered = lowerFilter
      ? restrictions.filter((r) => r.restriction.toLowerCase().includes(lowerFilter))
      : restrictions;

    const groups = new Map<string, Restriction[]>();
    for (const type of TYPE_ORDER) {
      groups.set(type, []);
    }
    for (const r of filtered) {
      const list = groups.get(r.type);
      if (list) {
        list.push(r);
      }
    }
    // Remove empty groups
    for (const [type, list] of groups) {
      if (list.length === 0) {
        groups.delete(type);
      }
    }
    return groups;
  }, [restrictions, filter]);

  return (
    <div className="space-y-3">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter restrictions..."
        className="h-8 text-sm"
      />
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {grouped.size === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No restrictions found.</p>
        ) : (
          Array.from(grouped.entries()).map(([type, items]) => (
            <div key={type}>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {type}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {items.map((r) => {
                  const isSelected = selected.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onToggle(r)}
                      className={`rounded-full border px-2.5 py-0.5 text-sm transition-colors ${
                        isSelected
                          ? "border-primary/60 bg-primary/20 text-foreground"
                          : "border-border/40 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {r.restriction}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
