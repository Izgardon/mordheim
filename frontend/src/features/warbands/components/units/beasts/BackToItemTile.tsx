import { useState } from "react";

import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";
import { cn } from "@/lib/utils";
import BackToItemDialog from "./BackToItemDialog";
import { cardPanelStyle, tilePadding } from "../expanded/ExpandedTiles";

import type { CardLayout } from "../../../units/unit-slot-types";
import type { HenchmenGroup } from "../../../types/warband-types";

/** A creature group's tile (editors only): members go back to the beast's item, in the stash. */
export default function BackToItemTile({
  group,
  warbandId,
  layout,
}: {
  group: HenchmenGroup;
  warbandId: number;
  layout: CardLayout;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 text-left text-sm font-semibold transition-colors hover:border-orange-300/70",
          tilePadding(layout)
        )}
        style={cardPanelStyle}
      >
        <BeastKindIcon kind="creature" className={BEAST_KIND_TEXT.creature} />
        Back to item
      </button>
      {open ? (
        <BackToItemDialog group={group} warbandId={warbandId} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}
