import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { groupItemsById } from "../../utils/warband-utils";
import { unitName, type RosterUnit } from "../roster/unit-view";
import type { WarbandItemSummary } from "../../types/warband-types";
import { StashList } from "./StashPanel";

type LoadoutPanelProps = {
  campaignId: number;
  warbandId: number;
  entry: RosterUnit | null;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  units: RosterUnit[];
  onMove: (from: RosterUnit | null, itemId: number, to: ItemPlace) => void;
  onSellFromStash: (item: WarbandItemSummary) => void;
  onOpenStore: () => void;
};

const SECTION = "pb-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-faint";

/**
 * One unit's loadout (design E), from its armour button or Add item: what it carries (To stash,
 * Give to), the stash to equip from, and the way to the store.
 */
export default function LoadoutPanel(props: LoadoutPanelProps) {
  const { entry } = props;
  const carrying = entry ? groupItemsById(entry.unit.items) : [];
  const others = props.units.filter(
    (other) => entry && !(other.kind === entry.kind && other.unit.id === entry.unit.id)
  );

  return (
    <SidePanel
      open={entry !== null}
      onOpenChange={props.onOpenChange}
      kicker="Loadout"
      title={entry ? unitName(entry.unit) : ""}
    >
      {entry ? (
        <>
          <section aria-label="Carrying" className="flex flex-col">
            <h3 className={SECTION}>Carrying</h3>
            {carrying.length === 0 ? <p className="text-sm text-text2">Nothing carried.</p> : null}
            {carrying.map((group) => (
              <div
                key={group.item.id}
                className="flex flex-wrap items-center gap-3 border-t border-line py-2.5"
              >
                <span className="min-w-0 flex-1 font-bold text-ink">
                  {group.item.name}
                  {group.count > 1 ? (
                    <span className="ml-1.5 font-mono text-xs text-accent-text">
                      ×{group.count}
                    </span>
                  ) : null}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {group.item.type}
                  </span>
                </span>
                {props.canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => props.onMove(entry, group.item.id, { type: "stash" })}
                    >
                      To stash
                    </Button>
                    <select
                      aria-label={`Give ${group.item.name} to`}
                      value=""
                      onChange={(event) => {
                        const [type, id] = event.target.value.split(":");
                        if (type)
                          props.onMove(entry, group.item.id, {
                            type: type as ItemPlace["type"],
                            id: Number(id),
                          });
                      }}
                      className="h-8 border border-strong bg-page px-2 text-xs text-ink"
                    >
                      <option value="">Give to…</option>
                      {others.map((other) => (
                        <option
                          key={`${other.kind}-${other.unit.id}`}
                          value={`${other.kind}:${other.unit.id}`}
                        >
                          {unitName(other.unit)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ))}
          </section>
          <section aria-label="In the stash" className="flex flex-col">
            <h3 className={SECTION}>In the stash</h3>
            <StashList
              campaignId={props.campaignId}
              warbandId={props.warbandId}
              canEdit={props.canEdit}
              units={props.units}
              forUnit={entry}
              onMove={(itemId, to) => props.onMove(null, itemId, to)}
              onSell={props.onSellFromStash}
            />
          </section>
          {props.canEdit ? (
            <Button variant="secondary" onClick={props.onOpenStore}>
              Buy something in the store
            </Button>
          ) : null}
        </>
      ) : null}
    </SidePanel>
  );
}
