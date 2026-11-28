import { useState, type ReactNode } from "react";

import { ItemKindIcon } from "@/components/ui/game-icons";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { itemKind, itemStatsLine, itemSubtype } from "@/features/items/item-kind";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { beastProfile, itemRuleLines } from "@/features/items/utils/item-rules";
import type { Item } from "@/features/items/types/item-types";
import { cameThrough, unitGroups, useSkillGroups } from "@/features/skills/skill-groups";
import { skillList } from "@/features/skills/skill-list";

import { useItemLabel } from "../../hooks/units/useItemLabel";
import type { ItemPlace } from "../../hooks/units/useUnitActions";
import type { AdvancePick } from "../../units/unit-api";
import { loadoutLine } from "../../units/loadout";
import { accessNames } from "../../utils/warband-utils";
import GroupMembers from "./GroupMembers";
import UnitBoxDetail, { type OpenBox } from "./UnitBoxDetail";
import UnitBoxRow, { PILL } from "./UnitBoxRow";
import UnitXp from "./UnitXp";
import { entryBoxes, type Row } from "./unit-boxes";
import { spellSections, usePrays } from "./spell-sections";
import {
  boxRows,
  buysItems,
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
  /** − and +: XP added or taken away (the server counts it half at half rate). */
  onXp: (change: number) => void;
  onMoveItem: (itemId: number, to: ItemPlace, material?: string) => void;
  onSellItem: (itemId: number, price: number, material?: string) => void;
  onBuyAgain: (item: Item) => void;
  /** A mount's Ride / Dismount, from its opened box. */
  onRide: (rowId: number, on: boolean) => void;
  /** Add item: the unit's loadout. */
  onLoadout: () => void;
  campaignId: number;
  warbandId: number;
  /** Makes a pick an advance left for later: the entry joins its list, one pick fewer. */
  onPick: (pick: AdvancePick) => void;
  /** Opened from the closed card's picks to choose: the first pick's box on this list starts open. */
  startPick?: PendingList;
};

/** Where the first box of a pick still to make on `list` sits. */
const pickBox = (rows: Row[], list?: PendingList): OpenBox | null => {
  if (!list) return null;
  for (const line of rows) {
    const index = line.boxes.findIndex((box) => box.pending === list);
    if (index >= 0) return { row: line.key, index };
  }
  return null;
};

/** An open card's body: experience across the top, then design E's columns on the web (items, skills and the rest). */
export default function UnitDetails(props: UnitDetailsProps) {
  const { entry, campaign, canEdit, others } = props;
  const { kind } = entry;
  // undefined until a box is opened or closed: the box of the pick he came to make, if any
  const [chosen, setOpen] = useState<OpenBox | null>();
  // on a phone a box's detail opens under the line of boxes holding it (William, 25 Nov 2026);
  // the web's columns are too narrow for it, so it sits under them all
  const inSection = useMediaQuery("(max-width: 960px)");
  const lists = boxRows(entry);
  const prays = usePrays(entry, props.campaignId);
  const picks = pendingPicks(entry, "spells");
  const itemLabel = useItemLabel(props.campaignId, props.warbandId);
  const groups = useSkillGroups(props.campaignId);
  const access = "available_skills" in entry.unit ? entry.unit.available_skills : undefined;
  const his = unitGroups(groups, accessNames(access));
  const skills = lists.skills.map((skill) => {
    const via = cameThrough(groups, skill.id, his);
    return { ...skill, type: via?.name, list: skillList(via?.access_name) };
  });

  const itemsRow: Row = {
    key: "items",
    label: kind === "henchmen_group" ? "Each carries" : "Items",
    icon: "items",
    boxes: lists.items.map((item) => ({
      name: itemLabel(entry.unit, item),
      subtitle: itemSubtype(item),
      kind: itemStatsLine(item),
      rules: itemRuleLines(item),
      profile: beastProfile(item),
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
      boxes: entryBoxes(entry, "skills", skills),
    },
    {
      key: "specials",
      label: "Specials",
      icon: "specials" as const,
      boxes: entryBoxes(entry, "specials", lists.specials),
    },
    ...spellSections(lists.spells, picks, prays).map((section) => ({
      key: section.key,
      label: section.label,
      icon: "spells" as const,
      boxes: entryBoxes(entry, "spells", section.spells, {
        count: section.picks ? picks : 0,
        noun: section.key === "prayers" ? "Prayer" : "Spell",
      }),
    })),
  ].filter((row) => row.boxes.length > 0);
  const all = [itemsRow, ...skillRows];
  const open = chosen === undefined ? pickBox(skillRows, props.startPick) : chosen;
  const selectedRow = all.find((row) => row.key === open?.row);
  const selected = open && selectedRow ? selectedRow.boxes[open.index] : undefined;

  const detail =
    open && selected ? (
      <UnitBoxDetail
        box={selected}
        open={open}
        entry={entry}
        campaignId={props.campaignId}
        warbandId={props.warbandId}
        canEdit={canEdit}
        others={others}
        onClose={() => setOpen(null)}
        onRide={props.onRide}
        onPick={props.onPick}
        onMoveItem={props.onMoveItem}
        onSellItem={props.onSellItem}
        onBuyAgain={props.onBuyAgain}
      />
    ) : null;

  const row = (line: Row, extra?: ReactNode) => {
    const here = open?.row === line.key;
    return (
      <UnitBoxRow
        key={line.key}
        line={line}
        selected={selected}
        openIndex={here ? open?.index : undefined}
        panel={inSection && here ? detail : null}
        extra={extra}
        onToggle={(index) =>
          setOpen(selected === line.boxes[index] ? null : { row: line.key, index })
        }
      />
    );
  };
  const members = isGroup(entry) && !isCreature(entry);
  const addsItems = canEdit && buysItems(entry);
  const showItems = lists.items.length > 0 || addsItems;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <UnitXp entry={entry} campaign={campaign} canEdit={canEdit} onXp={props.onXp} />
      <div className="grid gap-x-6 gap-y-4 min-[960px]:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {showItems ? (
          <div className="flex flex-col gap-2">
            {row(
              itemsRow,
              addsItems ? (
                <button
                  type="button"
                  onClick={props.onLoadout}
                  className={cn(
                    "min-h-12 border border-dashed border-strong px-3 text-[13px] font-bold text-accent-text hover:bg-raised",
                    PILL
                  )}
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
        {members ? (
          <div className="flex flex-col gap-3.5">
            <GroupMembers
              group={entry.unit}
              campaignId={props.campaignId}
              warbandId={props.warbandId}
              canEdit={canEdit}
            />
          </div>
        ) : null}
      </div>
      {inSection ? null : detail}
    </div>
  );
}
