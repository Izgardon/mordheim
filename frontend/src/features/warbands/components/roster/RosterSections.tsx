import type { ReactNode } from "react";

import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { Item } from "@/features/items/types/item-types";

import { useWarbandHireTemplate } from "../../api/warband-template-queries";
import { useUnitActions } from "../../hooks/units/useUnitActions";
import type { UnitKindKey } from "../../types/units";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandHireling,
  WarbandResource,
  WarbandRosterCounts,
} from "../../types/warband-types";
import { ROSTER_HEROES, ROSTER_SECTIONS } from "../page/warband-layout";
import RecruitForm from "./RecruitForm";
import RosterSection from "./RosterSection";
import UnitCard from "./UnitCard";
import UnitDetails from "./UnitDetails";
import { unitKey, type RosterUnit } from "./unit-view";
import { useRosterCards } from "./useRosterCards";

type RosterSectionsProps = {
  warbandId: number;
  campaign: CampaignSummary | null;
  heroes: WarbandHero[];
  henchmenGroups: HenchmenGroup[];
  hirelings: WarbandHireling[];
  /** The warband's resources, which a hire fee pays from. */
  resources: WarbandResource[];
  /** The warband's gold and type: a hire from its template tallies against them. */
  gold?: number;
  typeName?: string;
  /** The server's cap counts: one in a hero's place is a hero, a dramatis persona no hired sword. */
  counts?: Pick<WarbandRosterCounts, "hero_count" | "hireling_count">;
  canEdit: boolean;
  canCreateRace: boolean;
  onLoadout: (entry: RosterUnit) => void;
  /** Hire: the hire picker (the catalogue), whose "someone not in the list" comes back here. */
  onHire: () => void;
  /** The edit form for the unit being edited, rendered inside its open card. */
  renderEdit: (entry: RosterUnit, close: () => void) => ReactNode;
  /** Opens the level-up for a unit with an advance waiting. */
  onAdvance: (entry: RosterUnit) => void;
  /** Buy again on a carried item: the store for that unit with the item open. */
  onBuyAgain: (entry: RosterUnit, item: Item) => void;
};

/** The roster tab: heroes as cards in a grid, henchmen and hired swords as rows (design E). */
export default function RosterSections(props: RosterSectionsProps) {
  const { warbandId, campaign, canEdit } = props;
  const actions = useUnitActions(warbandId);
  // read ahead for Add hero and Add group, so Recruit as is there when they open (the templates plan)
  useWarbandHireTemplate(campaign?.id ?? 0, warbandId, canEdit);
  const cards = useRosterCards();

  const heroes: RosterUnit[] = props.heroes.map((unit) => ({ kind: "hero", unit }));
  const groups: RosterUnit[] = props.henchmenGroups.map((unit) => ({
    kind: "henchmen_group",
    unit,
  }));
  const hired: RosterUnit[] = props.hirelings.map((unit) => ({ kind: "hireling", unit }));
  const everyone = [...heroes, ...groups, ...hired];

  const recruitForm = (kind: UnitKindKey, list: RosterUnit[]) =>
    canEdit && cards.recruiting === kind ? (
      <RecruitForm
        kind={kind}
        campaignId={campaign?.id ?? 0}
        warbandId={warbandId}
        typeName={props.typeName ?? ""}
        gold={props.gold ?? 0}
        resources={props.resources}
        existingIds={list.map((entry) => entry.unit.id)}
        canCreateRace={props.canCreateRace}
        onCancel={() => cards.setRecruiting(null)}
        onCreated={cards.recruited}
      />
    ) : null;

  const card = (entry: RosterUnit, layout: "hero" | "row") => {
    const key = unitKey(entry);
    const open = cards.openKey === key;
    const editing = open && cards.editKey === key;
    return (
      <UnitCard
        key={key}
        entry={entry}
        campaign={campaign}
        warbandId={warbandId}
        layout={layout}
        open={open}
        editing={editing}
        canEdit={canEdit}
        onToggle={() => cards.toggle(key)}
        onEdit={() => cards.startEdit(key)}
        onLoadout={() => props.onLoadout(entry)}
        onRide={(rowId, on) => actions.rideMount(entry, rowId, on)}
        onAdvance={() => props.onAdvance(entry)}
        onTradingAction={(on) => actions.patchUnit(entry, { trading_action: on })}
      >
        {editing ? (
          props.renderEdit(entry, cards.stopEdit)
        ) : open ? (
          <UnitDetails
            entry={entry}
            campaign={campaign}
            canEdit={canEdit}
            others={everyone.filter((other) => unitKey(other) !== key)}
            onXp={(change) => actions.patchUnit(entry, { xp_change: change })}
            onMoveItem={(itemId, to) => actions.moveItem(entry, itemId, to)}
            onSellItem={(itemId, price) => actions.sellItem(entry, itemId, price)}
            onBuyAgain={(item) => props.onBuyAgain(entry, item)}
            onLoadout={() => props.onLoadout(entry)}
            onAdvance={() => props.onAdvance(entry)}
            campaignId={campaign?.id ?? 0}
            warbandId={warbandId}
            onPick={(pick) => actions.pickLater(entry, pick)}
          />
        ) : null}
      </UnitCard>
    );
  };

  const maxHeroes = campaign?.max_heroes;
  const maxHired = campaign?.max_hired_swords;
  const models = props.henchmenGroups.reduce((sum, group) => sum + group.henchmen.length, 0);

  return (
    <div className={ROSTER_SECTIONS}>
      <RosterSection
        title="Heroes"
        meta={`${props.counts?.hero_count ?? heroes.length}${maxHeroes ? ` of ${maxHeroes}` : ""}`}
        add={canEdit ? "Add hero" : undefined}
        onAdd={() => cards.setRecruiting("hero")}
        form={recruitForm("hero", heroes)}
      >
        <div className={ROSTER_HEROES}>{heroes.map((entry) => card(entry, "hero"))}</div>
      </RosterSection>
      <RosterSection
        title="Henchmen"
        meta={`${groups.length} ${groups.length === 1 ? "group" : "groups"} · ${models} models`}
        add={canEdit ? "Add group" : undefined}
        divided
        onAdd={() => cards.setRecruiting("henchmen_group")}
        form={recruitForm("henchmen_group", groups)}
      >
        <div className="flex flex-col gap-2.5">{groups.map((entry) => card(entry, "row"))}</div>
      </RosterSection>
      <RosterSection
        title="Hired swords"
        meta={`${props.counts?.hireling_count ?? hired.length}${maxHired ? ` of ${maxHired}` : ""}`}
        add={canEdit ? "Hire" : undefined}
        divided
        onAdd={props.onHire}
        form={recruitForm("hireling", hired)}
      >
        {/* cards in the heroes' grid (William: "make hired sword cards on web the same as hero
            cards in terms of shape, rather than full width") */}
        <div className={ROSTER_HEROES}>{hired.map((entry) => card(entry, "hero"))}</div>
      </RosterSection>
    </div>
  );
}
