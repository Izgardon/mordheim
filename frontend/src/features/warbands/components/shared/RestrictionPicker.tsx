import { useMemo, useState } from "react";

import { Chip } from "@/components/ui/chip";
import { Input } from "@components/input";

import type { Restriction } from "../../../items/types/item-types";

const TYPE_ORDER = ["Setting", "Warband Group", "Warband"] as const;

type RestrictionPickerProps = {
  restrictions: Restriction[];
  selected: Set<number>;
  onToggle: (restriction: Restriction) => void;
  showFilter?: boolean;
};

export default function RestrictionPicker({
  restrictions,
  selected,
  onToggle,
  showFilter = true,
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
      {showFilter ? (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter restrictions..."
          className="h-8 text-sm"
        />
      ) : null}
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {grouped.size === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No restrictions found.</p>
        ) : (
          Array.from(grouped.entries()).map(([type, items]) => (
            <div key={type}>
              <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
                {type}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {items.map((r) => {
                  const isSelected = selected.has(r.id);
                  return (
                    <Chip key={r.id} pressed={isSelected} onClick={() => onToggle(r)}>
                      {r.restriction}
                    </Chip>
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
