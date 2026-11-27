import { Button } from "@/components/ui/button";
import { SectionedSelect } from "@/components/ui/sectioned-select";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import SellControl from "./SellControl";
import { placeOf, unitSections } from "./unit-sections";
import type { RosterUnit } from "./unit-view";

/** An opened item's actions: its own first (Ride for a mount, Recruit for a creature), then the rest. */
export type ItemActions = {
  targets: RosterUnit[];
  onMove: (to: ItemPlace) => void;
  onSell: (price: number) => void;
  /** Opens the store for the unit with this item, at the campaign's current price. */
  onBuyAgain: () => void;
  /** A mount's: ridden now, and the switch the card's Mounted / On foot badge presses too. */
  ride?: { riding: boolean; onRide: (on: boolean) => void };
  /** A creature's: its copies become henchmen. */
  onMakeHenchmen?: () => void;
};

/** Small buttons, so the row fits one line on a phone. */
const SMALL = "h-8 px-1.5";

/**
 * An opened item's actions in one row above its rules (William, 25 Nov 2026): the main action,
 * Move to, Stash, Sell (its price in place once pressed) and Buy again.
 */
export default function ItemActionRow({
  actions,
  suggested,
}: {
  actions: ItemActions;
  /** The sale price offered: the copies' suggested price. */
  suggested: number;
}) {
  return (
    <div data-testid="item-actions" className="flex flex-wrap items-center gap-1">
      {actions.ride ? (
        <Button
          size="sm"
          className={SMALL}
          onClick={() => actions.ride?.onRide(!actions.ride.riding)}
        >
          {actions.ride.riding ? "Dismount" : "Ride"}
        </Button>
      ) : null}
      {actions.onMakeHenchmen ? (
        <Button size="sm" className={SMALL} onClick={actions.onMakeHenchmen}>
          Recruit
        </Button>
      ) : null}
      <SectionedSelect
        aria-label="Move to"
        placeholder="Move to…"
        value=""
        sections={unitSections(actions.targets)}
        className="h-8 w-auto gap-0.5 pl-1.5 pr-1 text-xs md:h-8"
        contentClassName="w-56 max-w-[calc(100vw-2rem)]"
        onValueChange={(value) => {
          const to = placeOf(value);
          if (to) actions.onMove(to);
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        className={SMALL}
        onClick={() => actions.onMove({ type: "stash" })}
      >
        Stash
      </Button>
      <SellControl suggested={suggested} onSell={actions.onSell} className={SMALL} />
      <Button size="sm" variant="secondary" className={SMALL} onClick={actions.onBuyAgain}>
        Buy again
      </Button>
    </div>
  );
}
