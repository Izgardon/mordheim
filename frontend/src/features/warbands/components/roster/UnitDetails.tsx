import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { BoxTile, type BoxTileKind } from "@/components/ui/box-tile";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { Item } from "@/features/items/types/item-types";

import type { ItemPlace } from "../../hooks/units/useUnitActions";
import { isPendingByName, isPendingByType } from "../heroes/utils/pending-entries";
import PendingPick, { type PendingList } from "./PendingPick";
import RulesPanel, { type BoxDetail } from "./RulesPanel";
import UnitKills from "./UnitKills";
import { boxRows, itemBoxKind, xpInfo, type RosterUnit } from "./unit-view";

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
  /** Puts the picked entry in place of a pending "New skill" (spell, special). */
  onResolvePending: (list: PendingList, placeholderId: number, entryId: number) => void;
};

type Box = BoxDetail & { boxKind: BoxTileKind; id?: number; pending?: boolean };
type Row = { key: string; label: string; boxes: Box[] };

const NOUN: Record<string, "skill" | "spell" | "special"> = {
  skills: "skill",
  spells: "spell",
  specials: "special",
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
  const [confirmTrade, setConfirmTrade] = useState(false);
  const xp = xpInfo(entry, campaign);
  const rows = boxRows(entry);

  const lines: Row[] = [
    {
      key: "items",
      label: kind === "henchmen_group" ? "Items · each" : "Items",
      boxes: rows.items.map((item) => ({
        name: item.name,
        kind: itemKindLine(item),
        text: item.description,
        rules: item.properties?.map((property) => property.name),
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
      boxes: list.map((entry) => {
        const pending =
          key in NOUN && (isPendingByType(entry) || isPendingByName(NOUN[key], entry.name));
        return {
          id: entry.id,
          pending,
          name: entry.name,
          kind: pending ? "Pick one" : (entry.type ?? label),
          text: entry.description,
          boxKind: (key === "injuries" ? "injury" : pending ? "item" : "quiet") as BoxTileKind,
        };
      }),
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
            {selected?.pending && selected.id !== undefined && canEdit ? (
              <PendingPick
                campaignId={props.campaignId}
                list={row.key as PendingList}
                access={"available_skills" in unit ? unit.available_skills : undefined}
                onClose={() => setOpen(null)}
                onPick={(entryId) => {
                  setOpen(null);
                  props.onResolvePending(row.key as PendingList, selected.id!, entryId);
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

      <UnitKills campaignId={props.campaignId} warbandId={props.warbandId} entry={entry} />
      {kind === "hireling" ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[13px]">
          <dt className="text-faint">Upkeep</dt>
          <dd className="m-0 text-ink">{entry.unit.upkeep_price ?? 0} gc</dd>
        </dl>
      ) : null}
      {kind === "hero" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Switch
            checked={Boolean(entry.unit.trading_action)}
            disabled={!canEdit}
            onCheckedChange={() => setConfirmTrade(true)}
          >
            Trading action
          </Switch>
          {confirmTrade ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setConfirmTrade(false);
                  props.onTradingAction(!entry.unit.trading_action);
                }}
              >
                {entry.unit.trading_action ? "Take it away" : "Give the trading action"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmTrade(false)}>
                Cancel
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
