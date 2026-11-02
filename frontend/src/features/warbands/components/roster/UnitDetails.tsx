import { useState, type ReactNode } from "react";

import { BoxTile, type BoxTileKind } from "@/components/ui/box-tile";
import { ItemKindIcon, GameIcon, type GameIconName } from "@/components/ui/game-icons";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { itemKind, itemKindLine } from "@/features/items/item-kind";
import type { Item } from "@/features/items/types/item-types";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { loadoutLine } from "../../units/loadout";
import GroupMembers from "./GroupMembers";
import PendingPick from "./PendingPick";
import RulesPanel, { type BoxDetail } from "./RulesPanel";
import UnitSectionLabel from "./UnitSectionLabel";
import UnitXp from "./UnitXp";
import {
  boxRows,
  isCreature,
  isGroup,
  itemBoxKind,
  pendingPicks,
  type PendingList,
  type RosterUnit,
} from "./unit-view";

type UnitDetailsProps = {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  canEdit: boolean;
  /** The other units an item can move to. */
  others: RosterUnit[];
  onXp: (xp: number) => void;
  onMoveItem: (itemId: number, to: ItemPlace) => void;
  onSellItem: (itemId: number, price: number) => void;
  onBuyAgain: (item: Item) => void;
  /** Add item: the unit's loadout. */
  onLoadout: () => void;
  onAdvance?: () => void;
  campaignId: number;
  warbandId: number;
  /** Makes a pick an advance left for later: the entry joins `list`, one pick fewer. */
  onPick: (list: PendingList, entryId: number) => void;
};

type Box = BoxDetail & { boxKind: BoxTileKind; icon: ReactNode; pending?: PendingList };
type Row = { key: string; label: string; icon: GameIconName; boxes: Box[] };

const NOUN: Record<PendingList, string> = {
  skills: "Skill",
  spells: "Spell",
  specials: "Special",
};

const itemStats = (item: Item) =>
  [
    itemKindLine(item),
    item.strength && `S ${item.strength}`,
    item.range,
    item.save && `Save ${item.save}`,
  ]
    .filter(Boolean)
    .join(" · ");

/** An open card's body (design E's columns on the web): experience, items, skills and the rest. */
export default function UnitDetails(props: UnitDetailsProps) {
  const { entry, campaign, canEdit, others } = props;
  const { unit, kind } = entry;
  const [open, setOpen] = useState<{ row: string; index: number } | null>(null);
  const lists = boxRows(entry);

  const entryBoxes = (
    list: PendingList | "injuries",
    entries: { name: string; type?: string | null; description?: string | null; dc?: unknown }[],
    icon: GameIconName,
    boxKind: BoxTileKind
  ): Box[] => [
    ...entries.map((entry) => {
      const difficulty = entry.dc !== null && entry.dc !== undefined && entry.dc !== "";
      const line = [entry.type, difficulty && `Difficulty ${String(entry.dc)}`]
        .filter(Boolean)
        .join(" · ");
      return {
        name: entry.name,
        kind: line,
        text: entry.description,
        boxKind,
        icon: <GameIcon name={icon} />,
      };
    }),
    // the picks an advance left for later, each picked from its box
    ...(list === "injuries"
      ? []
      : Array.from({ length: pendingPicks(entry, list) }, () => ({
          name: `${NOUN[list]} to choose`,
          kind: "Pick one",
          boxKind: "pending" as BoxTileKind,
          icon: <GameIcon name={icon} />,
          pending: list,
        }))),
  ];

  const itemsRow: Row = {
    key: "items",
    label: kind === "henchmen_group" ? "Each carries" : "Items",
    icon: "items",
    boxes: lists.items.map((item) => ({
      name: item.name,
      kind: itemStats(item),
      text: item.flavour ?? "",
      rules: item.rules?.map((rule) => rule.name).filter(Boolean),
      item,
      boxKind: itemBoxKind(item),
      icon: <ItemKindIcon kind={itemKind(item)} />,
    })),
  };
  const skillRows: Row[] = [
    {
      key: "skills",
      label: "Skills",
      icon: "skills" as const,
      boxes: entryBoxes("skills", lists.skills, "skills", "skill"),
    },
    {
      key: "specials",
      label: "Specials",
      icon: "specials" as const,
      boxes: entryBoxes("specials", lists.specials, "specials", "special"),
    },
    {
      key: "spells",
      label: "Spells",
      icon: "spells" as const,
      boxes: entryBoxes("spells", lists.spells, "spells", "spell"),
    },
  ].filter((row) => row.boxes.length > 0);
  const injuries: Row = {
    key: "injuries",
    label: "Injuries",
    icon: "injuries",
    boxes: entryBoxes("injuries", lists.injuries, "injuries", "injury"),
  };
  const all = [itemsRow, ...skillRows, injuries];
  const selectedRow = all.find((row) => row.key === open?.row);
  const selected = open && selectedRow ? selectedRow.boxes[open.index] : undefined;

  const row = (line: Row, extra?: ReactNode) => (
    <div key={line.key} className="flex flex-col gap-2">
      <UnitSectionLabel icon={line.icon}>{line.label}</UnitSectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {line.boxes.map((box, index) => (
          <BoxTile
            key={`${box.name}-${index}`}
            name={box.name}
            type={box.kind}
            kind={box.boxKind}
            icon={box.icon}
            pressed={selected === box}
            onClick={() => setOpen(selected === box ? null : { row: line.key, index })}
          />
        ))}
        {extra}
      </div>
    </div>
  );
  const members = isGroup(entry) && !isCreature(entry);
  const showItems = lists.items.length > 0 || (canEdit && !isCreature(entry));
  const showRest = injuries.boxes.length > 0 || members;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="grid gap-x-6 gap-y-4 min-[960px]:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <UnitXp
          entry={entry}
          campaign={campaign}
          canEdit={canEdit}
          onXp={props.onXp}
          onAdvance={props.onAdvance}
        />
        {showItems ? (
          <div className="flex flex-col gap-2">
            {row(
              itemsRow,
              canEdit && !isCreature(entry) ? (
                <button
                  type="button"
                  onClick={props.onLoadout}
                  className="min-h-12 border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised"
                >
                  Add item
                </button>
              ) : null
            )}
            {isGroup(entry) && lists.items.length ? (
              <span className="font-mono text-xs text-muted-foreground">
                {loadoutLine(entry.unit)}
              </span>
            ) : null}
          </div>
        ) : null}
        {skillRows.length ? (
          <div className="flex flex-col gap-3.5">{skillRows.map((line) => row(line))}</div>
        ) : null}
        {showRest ? (
          <div className="flex flex-col gap-3.5">
            {injuries.boxes.length ? row(injuries) : null}
            {members ? (
              <GroupMembers
                group={entry.unit}
                campaignId={props.campaignId}
                warbandId={props.warbandId}
                canEdit={canEdit}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {selected?.pending && canEdit ? (
        <PendingPick
          campaignId={props.campaignId}
          warbandId={props.warbandId}
          list={selected.pending}
          access={"available_skills" in unit ? unit.available_skills : undefined}
          large={unit.large}
          onClose={() => setOpen(null)}
          onPick={(entryId) => {
            setOpen(null);
            props.onPick(selected.pending!, entryId);
          }}
        />
      ) : selected ? (
        <RulesPanel
          detail={selected}
          onClose={() => setOpen(null)}
          itemActions={
            canEdit && selected.item
              ? {
                  owner: entry,
                  targets: others,
                  onMove: (to) => {
                    setOpen(null);
                    props.onMoveItem(selected.item!.id, to);
                  },
                  onSell: (price) => {
                    setOpen(null);
                    props.onSellItem(selected.item!.id, price);
                  },
                  onBuyAgain: () => props.onBuyAgain(selected.item!),
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
