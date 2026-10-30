import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { Item } from "@/features/items/types/item-types";

import { useUnitActions } from "../../hooks/units/useUnitActions";
import type { HenchmenGroup, WarbandHero, WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import UnitDetails from "./UnitDetails";
import type { PendingList } from "./PendingPick";
import { unitKey, type RosterUnit } from "./unit-view";

type RosterSectionsProps = {
  warbandId: number;
  campaign: CampaignSummary | null;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  canEdit: boolean;
  onLoadout: (entry: RosterUnit) => void;
  onRecruit: (kind: RosterUnit["kind"]) => void;
  /** The edit form for the unit being edited, rendered inside its open card. */
  renderEdit: (entry: RosterUnit, close: () => void) => ReactNode;
  /** Opens the level-up for a unit with an advance waiting. */
  onAdvance: (entry: RosterUnit) => void;
  /** Buy again on a carried item: the store for that unit with the item open. */
  onBuyAgain: (entry: RosterUnit, item: Item) => void;
};

function Section({
  title,
  meta,
  add,
  onAdd,
  children,
}: {
  title: string;
  meta: string;
  add?: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-display text-[22px] font-semibold text-head">{title}</h2>
          <span className="text-[13px] text-faint">{meta}</span>
        </div>
        {add ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex min-h-9 items-center gap-1.5 border border-border px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {add}
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const ID_FIELD = { skills: "skill_ids", spells: "spell_ids", specials: "special_ids" } as const;

/** The unit's ids for `list` with the first `placeholderId` swapped for `entryId`. */
function swapPending(entry: RosterUnit, list: PendingList, placeholderId: number, entryId: number) {
  const unit = entry.unit as Partial<Record<PendingList, { id: number }[]>>;
  let swapped = false;
  const ids = (unit[list] ?? []).map(({ id }) => {
    if (swapped || id !== placeholderId) return id;
    swapped = true;
    return entryId;
  });
  return { [ID_FIELD[list]]: ids };
}

/** The roster tab: heroes as cards in a grid, henchmen and hired swords as rows (design E). */
export default function RosterSections(props: RosterSectionsProps) {
  const { warbandId, campaign, canEdit } = props;
  const actions = useUnitActions(warbandId);
  // A link to a unit (Search everything, `?unit=hero-12`) opens its card and scrolls to it.
  const [searchParams] = useSearchParams();
  const linked = searchParams.get("unit");
  const [openKey, setOpenKey] = useState<string | null>(linked);
  useEffect(() => {
    if (!linked) return;
    setOpenKey(linked);
    requestAnimationFrame(() =>
      document.getElementById(`unit-${linked}`)?.scrollIntoView({ block: "start" })
    );
  }, [linked]);
  const [editKey, setEditKey] = useState<string | null>(null);

  const heroes: RosterUnit[] = props.heroes.map((unit) => ({ kind: "hero", unit }));
  const groups: RosterUnit[] = props.henchmenGroups.map((unit) => ({
    kind: "henchmen_group",
    unit,
  }));
  const hired: RosterUnit[] = props.hirelings.map((unit) => ({ kind: "hireling", unit }));
  const everyone = [...heroes, ...groups, ...hired];

  const card = (entry: RosterUnit, layout: "hero" | "row") => {
    const key = unitKey(entry);
    const open = openKey === key;
    const editing = open && editKey === key;
    return (
      <UnitCard
        key={key}
        entry={entry}
        campaign={campaign}
        layout={layout}
        open={open}
        canEdit={canEdit && !editing}
        onToggle={() => {
          setOpenKey(open ? null : key);
          setEditKey(null);
        }}
        onEdit={() => setEditKey(key)}
        onLoadout={() => props.onLoadout(entry)}
        onRide={(rowId, on) => actions.rideMount(entry, rowId, on)}
      >
        {editing ? (
          props.renderEdit(entry, () => setEditKey(null))
        ) : open ? (
          <UnitDetails
            entry={entry}
            campaign={campaign}
            canEdit={canEdit}
            others={everyone.filter((other) => unitKey(other) !== key)}
            onXp={(xp) => actions.patchUnit(entry, { xp })}
            onTradingAction={(on) => actions.patchUnit(entry, { trading_action: on })}
            onMoveItem={(itemId, to) => actions.moveItem(entry, itemId, to)}
            onSellItem={(itemId, price) => actions.sellItem(entry, itemId, price)}
            onBuyAgain={(item) => props.onBuyAgain(entry, item)}
            onAdvance={() => props.onAdvance(entry)}
            campaignId={campaign?.id ?? 0}
            onResolvePending={(list, placeholderId, entryId) =>
              actions.patchUnit(entry, swapPending(entry, list, placeholderId, entryId))
            }
          />
        ) : null}
      </UnitCard>
    );
  };

  const maxHeroes = campaign?.max_heroes;
  const maxHired = campaign?.max_hired_swords;
  const models = props.henchmenGroups.reduce((sum, group) => sum + group.henchmen.length, 0);

  return (
    <div className="flex flex-col gap-[30px]">
      <Section
        title="Heroes"
        meta={`${heroes.length}${maxHeroes ? ` of ${maxHeroes}` : ""}`}
        add={canEdit ? "Add hero" : undefined}
        onAdd={() => props.onRecruit("hero")}
      >
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr))]">
          {heroes.map((entry) => card(entry, "hero"))}
        </div>
      </Section>
      <Section
        title="Henchmen"
        meta={`${groups.length} ${groups.length === 1 ? "group" : "groups"} · ${models} models`}
        add={canEdit ? "Add group" : undefined}
        onAdd={() => props.onRecruit("henchmen_group")}
      >
        <div className="flex flex-col gap-2.5">{groups.map((entry) => card(entry, "row"))}</div>
      </Section>
      <Section
        title="Hired swords"
        meta={`${hired.length}${maxHired ? ` of ${maxHired}` : ""}`}
        add={canEdit ? "Hire" : undefined}
        onAdd={() => props.onRecruit("hireling")}
      >
        <div className="flex flex-col gap-2.5">{hired.map((entry) => card(entry, "row"))}</div>
      </Section>
    </div>
  );
}
