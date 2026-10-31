import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { BoxTile, type BoxTileKind } from "@/components/ui/box-tile";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { Item } from "@/features/items/types/item-types";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import PendingPick from "./PendingPick";
import RulesPanel, { type BoxDetail } from "./RulesPanel";
import TradingActionSwitch from "./TradingActionSwitch";
import UnitKills from "./UnitKills";
import { loadoutLine } from "../../units/loadout";
import GroupMembers from "./GroupMembers";
import {
  boxRows,
  isCreature,
  isGroup,
  itemBoxKind,
  pendingPicks,
  xpInfo,
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
  onTradingAction: (on: boolean) => void;
  onMoveItem: (itemId: number, to: ItemPlace) => void;
  onSellItem: (itemId: number, price: number) => void;
  onBuyAgain: (item: Item) => void;
  onAdvance?: () => void;
  campaignId: number;
  warbandId: number;
  /** Makes a pick an advance left for later: the entry joins `list`, one pick fewer. */
  onPick: (list: PendingList, entryId: number) => void;
};

type Box = BoxDetail & { boxKind: BoxTileKind; pending?: boolean };
type Row = { key: string; label: string; boxes: Box[] };

const TO_CHOOSE: Record<string, string> = {
  skills: "Skill to choose",
  spells: "Spell to choose",
  specials: "Special to choose",
};

const itemKindLine = (item: NonNullable<BoxDetail["item"]>) =>
  [item.type, item.strength && `S ${item.strength}`, item.range, item.save && `Save ${item.save}`]
    .filter(Boolean)
    .join(" · ");

/** An open card's body: the XP bar, the rows of boxes with their rules, kills and the rest. */
export default function UnitDetails(props: UnitDetailsProps) {
  const { entry, campaign, canEdit, others } = props;
  const { unit, kind } = entry;
  const [open, setOpen] = useState<{ row: string; index: number } | null>(null);
  const xp = xpInfo(entry, campaign);
  const rows = boxRows(entry);

  const lines: Row[] = [
    {
      key: "items",
      label: kind === "henchmen_group" ? "Each carries" : "Items",
      boxes: rows.items.map((item) => ({
        name: item.name,
        kind: itemKindLine(item),
        text: item.flavour ?? "",
        rules: item.rules?.map((rule) => rule.name).filter(Boolean),
        item,
        boxKind: itemBoxKind(item),
      })),
    },
    ...(
      [
        ["skills", "Skills", rows.skills],
        ["specials", "Specials", rows.specials],
        ["spells", "Spells", rows.spells],
        ["injuries", "Injuries", rows.injuries],
      ] as const
    ).map(([key, label, list]) => ({
      key,
      label,
      boxes: [
        ...list.map((entry) => ({
          name: entry.name,
          kind: entry.type ?? label,
          text: entry.description,
          boxKind: (key === "injuries" ? "injury" : "quiet") as BoxTileKind,
        })),
        // the picks an advance left for later, each picked from its box
        ...Array.from(
          { length: key in TO_CHOOSE ? pendingPicks(entry, key as PendingList) : 0 },
          () => ({
            pending: true,
            name: TO_CHOOSE[key],
            kind: "Pick one",
            boxKind: "item" as BoxTileKind,
          })
        ),
      ],
    })),
  ].filter((row) => row.boxes.length > 0 || row.key === "items" || row.key === "skills");

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-3">
      {xp ? (
        <div className="flex items-center gap-3">
          {canEdit ? (
            <IconButton
              aria-label="One XP less"
              className="h-8 w-8"
              onClick={() => props.onXp(Math.max(0, xp.xp - 1))}
            >
              <Minus aria-hidden="true" />
            </IconButton>
          ) : null}
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-1.5 bg-line" aria-hidden="true">
              <div className="h-1.5 bg-primary" style={{ width: `${xp.share * 100}%` }} />
            </div>
            <span className="font-mono text-xs text-muted-foreground">{xp.text}</span>
          </div>
          {canEdit ? (
            <IconButton
              aria-label="One XP more"
              className="h-8 w-8"
              onClick={() => props.onXp(xp.xp + 1)}
            >
              <Plus aria-hidden="true" />
            </IconButton>
          ) : null}
          {xp.advanceReady && canEdit && props.onAdvance ? (
            <Button size="sm" onClick={props.onAdvance}>
              Advance
            </Button>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">No XP</span>
      )}

      {lines.map((row) => {
        const selected = open?.row === row.key ? row.boxes[open.index] : undefined;
        return (
          <div key={row.key} className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              {row.label}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {row.boxes.length === 0 ? (
                <span className="pt-1.5 text-[13px] text-text2">None yet</span>
              ) : null}
              {row.boxes.map((box, index) => (
                <BoxTile
                  key={`${box.name}-${index}`}
                  name={box.name}
                  type={row.key === "items" ? box.item?.type : box.kind}
                  kind={box.boxKind}
                  pressed={selected === box}
                  onClick={() => setOpen(selected === box ? null : { row: row.key, index })}
                />
              ))}
            </div>
            {row.key === "items" && isGroup(entry) ? (
              <span className="font-mono text-xs text-muted-foreground">
                {loadoutLine(entry.unit)}
              </span>
            ) : null}
            {selected?.pending && canEdit ? (
              <PendingPick
                campaignId={props.campaignId}
                warbandId={props.warbandId}
                list={row.key as PendingList}
                access={"available_skills" in unit ? unit.available_skills : undefined}
                large={unit.large}
                onClose={() => setOpen(null)}
                onPick={(entryId) => {
                  setOpen(null);
                  props.onPick(row.key as PendingList, entryId);
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
      })}

      {isGroup(entry) && !isCreature(entry) ? (
        <GroupMembers
          group={entry.unit}
          campaignId={props.campaignId}
          warbandId={props.warbandId}
          canEdit={canEdit}
        />
      ) : null}
      <UnitKills campaignId={props.campaignId} warbandId={props.warbandId} entry={entry} />
      {kind === "hireling" ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[13px]">
          <dt className="text-faint">Upkeep</dt>
          <dd className="m-0 text-ink">{entry.unit.upkeep_price ?? 0} gc</dd>
        </dl>
      ) : null}
      {kind === "hero" ? (
        <TradingActionSwitch
          on={Boolean(entry.unit.trading_action)}
          canEdit={canEdit}
          onChange={props.onTradingAction}
        />
      ) : null}
    </div>
  );
}
