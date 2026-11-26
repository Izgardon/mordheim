import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Item } from "@/features/items/types/item-types";

import MakeHenchmenSheet from "../roster/MakeHenchmenSheet";
import type { RosterUnit } from "../roster/unit-view";
import type { WarbandItemSummary } from "../../types/warband-types";

/** A creature in the stash: Recruit its copies as henchmen (the stash's newest first). */
export default function StashMakeHenchmen({
  warbandId,
  row,
  item,
  units,
  onDone,
}: {
  warbandId: number;
  row: WarbandItemSummary;
  /** The catalogue's entry, for its beast. */
  item: Item;
  units: RosterUnit[];
  onDone: () => void;
}) {
  const [making, setMaking] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" className="h-8 px-2.5" onClick={() => setMaking(true)}>
        Recruit
      </Button>
      {making ? (
        <MakeHenchmenSheet
          open
          onOpenChange={setMaking}
          warbandId={warbandId}
          copies={{
            source: { type: "stash", item_id: row.id },
            itemName: row.name,
            beastId: item.bestiary_entry?.id ?? null,
            most: row.quantity ?? 1,
          }}
          units={units}
          onDone={onDone}
        />
      ) : null}
    </div>
  );
}
