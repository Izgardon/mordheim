import { TriangleAlert } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "../../../shared/unit_details/warband-tooltip-styles";
import { calculateHenchmenReinforceCost } from "../../../henchmen/utils/henchmen-cost";
import { CostTile, SizeTile } from "../../expanded/ExpandedTiles";
import BackToItemTile from "../../beasts/BackToItemTile";
import CreatureMark from "../../beasts/CreatureMark";
import { isCreatureGroup } from "../../../../utils/companions";

import type { HenchmenGroup } from "../../../../types/warband-types";
import type { ExpandedTilesProps, SummaryHeaderProps } from "../../../../units/unit-slot-types";

const MISMATCH_WARNING =
  "Some items don't divide evenly across all henchmen — adjust item counts to match the group size.";

/** True when some item's count doesn't divide evenly across the members. */
export const hasItemMismatch = (group: HenchmenGroup) => {
  const memberCount = (group.henchmen ?? []).length;
  return (
    memberCount > 0 &&
    Object.values(
      (group.items ?? []).reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = (acc[item.id] ?? 0) + 1;
        return acc;
      }, {})
    ).some((count) => count % memberCount !== 0)
  );
};

/** Group summary header: name, level line with members/max size (default 5), item warning. */
export function HenchmenCardHeader({ unit: group, level }: SummaryHeaderProps<"henchmen_group">) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 px-4">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xl font-bold text-foreground">
          {isCreatureGroup(group) ? <CreatureMark /> : null}
          {group.name || "Untitled group"}
        </p>
        <p className="text-sm text-muted-foreground">
          Level {level} {group.unit_type || "Henchmen"}{" "}
          <span className="text-xs">
            ({(group.henchmen ?? []).length}/{group.max_size ?? 5})
          </span>
        </p>
      </div>
      {hasItemMismatch(group) ? (
        <Tooltip
          trigger={<TriangleAlert className="h-4 w-4 shrink-0 text-amber-400" />}
          content={MISMATCH_WARNING}
          maxWidth={240}
          className="mt-1"
          contentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
        />
      ) : null}
    </div>
  );
}

export function HenchmenExpandedTitle({ unit: group }: { unit: HenchmenGroup }) {
  return (
    <h2 className="flex items-center gap-1.5 text-2xl font-bold text-foreground">
      {isCreatureGroup(group) ? <CreatureMark /> : null}
      {group.name || "Unnamed Group"}
      {hasItemMismatch(group) && (
        <Tooltip
          trigger={<TriangleAlert className="h-5 w-5 shrink-0 text-amber-400" />}
          content={MISMATCH_WARNING}
          maxWidth={240}
          contentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
        />
      )}
    </h2>
  );
}

/**
 * Size and Reinforce Cost: the server's hire_cost (decision 7), broken down as base + one
 * member's item share + 2 x whole XP. A group recruited from a creature can go back to its item.
 */
export function HenchmenExpandedTiles({
  unit: group,
  warbandId,
  layout,
  canEdit,
}: ExpandedTilesProps<"henchmen_group">) {
  const { baseCost, xpCost, totalCost, itemBreakdown } = calculateHenchmenReinforceCost({
    price: group.price,
    xp: group.xp,
    items: group.items,
    henchmen: group.henchmen,
  });
  return (
    <>
      <SizeTile layout={layout} large={group.large} />
      <CostTile
        layout={layout}
        label="Reinforce Cost"
        total={group.hire_cost ?? totalCost}
        baseCost={baseCost}
        lines={itemBreakdown.map(({ item, multiplier, cost }) => ({
          key: item.id,
          label: (
            <>
              {item.name}
              {multiplier > 1 ? ` x${multiplier}` : ""}
            </>
          ),
          cost,
        }))}
        extraLines={[{ key: "xp", label: "Experience", cost: xpCost }]}
      />
      {canEdit && group.source_beast_id != null ? (
        <BackToItemTile group={group} warbandId={warbandId} layout={layout} />
      ) : null}
    </>
  );
}

/** Sum of the members' kills. */
export const sumMemberKills = (group: HenchmenGroup) =>
  (group.henchmen ?? []).reduce((sum, h) => sum + (h.kills || 0), 0);
