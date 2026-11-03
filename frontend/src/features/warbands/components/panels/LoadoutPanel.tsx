import { Button } from "@/components/ui/button";
import { ItemKindIcon } from "@/components/ui/game-icons";
import { ROW_SELECT, SectionedSelect } from "@/components/ui/sectioned-select";
import { SidePanel } from "@/components/ui/side-panel";
import { itemKind } from "@/features/items/item-kind";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { groupItemsById } from "../../utils/warband-utils";
import { placeOf, unitSections } from "../roster/unit-sections";
import { isGroup, unitName, type RosterUnit } from "../roster/unit-view";
import type { WarbandItemSummary } from "../../types/warband-types";
import { StashList } from "./StashPanel";

type LoadoutPanelProps = {
  campaignId: number;
  warbandId: number;
  entry: RosterUnit | null;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  units: RosterUnit[];
  onMove: (from: RosterUnit | null, itemId: number, to: ItemPlace, quantity?: number) => void;
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
  // A group's rows are its loadout: each counts the members who carry it (henchmen loadouts)
  const group = entry !== null && isGroup(entry);
  const carrying = !entry
    ? []
    : group
      ? entry.unit.items.map((item) => ({
          key: item.row_id ?? item.id,
          item,
          count: item.carriers ?? 0,
        }))
      : groupItemsById(entry.unit.items).map((line) => ({ key: line.item.id, ...line }));
  const sections = unitSections(
    props.units.filter(
      (other) => entry && !(other.kind === entry.kind && other.unit.id === entry.unit.id)
    )
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
            <h3 className={SECTION}>{group ? "Each carries" : "Carrying"}</h3>
            {carrying.length === 0 ? <p className="text-sm text-text2">Nothing carried.</p> : null}
            {carrying.map((line) => (
              <div
                key={line.key}
                className="flex flex-wrap items-center gap-3 border-t border-line py-2.5"
              >
                <ItemKindIcon kind={itemKind(line.item)} className="h-5 w-5 text-accent-text" />
                <span className="min-w-0 flex-1 font-bold text-ink">
                  {line.item.name}
                  {line.count > 1 ? (
                    <span className="ml-1.5 font-mono text-xs text-accent-text">×{line.count}</span>
                  ) : null}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {line.item.type}
                  </span>
                </span>
                {props.canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => props.onMove(entry, line.item.id, { type: "stash" })}
                    >
                      To stash
                    </Button>
                    <SectionedSelect
                      {...ROW_SELECT}
                      aria-label={`Give ${line.item.name} to`}
                      placeholder="Give to…"
                      value=""
                      sections={sections}
                      onValueChange={(value) => {
                        const to = placeOf(value);
                        if (to) props.onMove(entry, line.item.id, to);
                      }}
                    />
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
              onMove={(itemId, to, quantity) => props.onMove(null, itemId, to, quantity)}
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
