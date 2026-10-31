import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  DetailSection,
  FactLine,
  Flavour,
  ReferenceDetail,
  RuleBlock,
} from "@/features/reference/ReferenceDetail";
import { ProfileStrip } from "@/features/reference/profile";

import ItemFormDialog from "../components/ItemFormDialog";
import ItemRuleBlock, { RuleTableView } from "../components/ItemRuleBlock";
import { itemName, kindOf } from "../store/store-items";
import type { Item, ItemAvailability, ItemOffer, RuleTable } from "../types/item-types";
import { longCostNote, priceLabel, rarityLabel, whoLine } from "../utils/item-prices";
import { beastEditLink, beastOf, isSold } from "../utils/item-listing";

const PROFILE = ["profile", "m", "ws", "bs", "s", "t", "w", "i", "a", "ld"];
const PROFILE_LABELS = ["Profile", "M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"];

/** A vehicle's or an animal's profile rows (the item's statblock JSON) as a table; null without. */
function statblockTable(statblock: string | null | undefined): RuleTable | null {
  if (!statblock) return null;
  try {
    const rows = JSON.parse(statblock) as Record<string, string>[];
    if (!Array.isArray(rows) || !rows.length) return null;
    return {
      columns: PROFILE_LABELS,
      rows: rows.map((row) => PROFILE.map((key) => String(row[key] ?? ""))),
    };
  } catch {
    return null;
  }
}

/** "Town Cryer #6 · Mordheim, grade 1a · For Orc Mob, Night Goblins": where it comes from. */
export function sourceLine(item: Item, setting: Setting | undefined) {
  const first = item.availabilities?.[0];
  return [
    item.source,
    setting
      ? `${setting.name}, grade ${setting.grade}`
      : item.campaign_id
        ? "This campaign's own"
        : "",
    first ? whoLine(first) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function PriceRow({ row, chosen }: { row: ItemAvailability; chosen: boolean }) {
  return (
    <div
      className={
        chosen
          ? "flex flex-col gap-0.5 border border-accent-line bg-accent-soft px-2.5 py-2"
          : "flex flex-col gap-0.5 border border-border bg-surface px-2.5 py-2"
      }
    >
      <div className="flex justify-between gap-2.5">
        <span className="font-mono text-[13px] font-bold text-ink">
          {priceLabel(row)}
          {row.label ? <span className="font-sans text-text2"> · {row.label}</span> : null}
        </span>
        <span className="text-[13px] font-semibold text-text2">{rarityLabel(row.rarity)}</span>
      </div>
      {longCostNote(row) ? <span className="text-xs text-text2">{row.cost_note}</span> : null}
      <span className="text-xs text-text2">{whoLine(row)}</span>
      {row.note ? <span className="text-xs italic text-muted-foreground">{row.note}</span> : null}
    </div>
  );
}

type WargearDetailProps = {
  item: Item;
  offer: ItemOffer | undefined;
  /** The offer's warning, or the out-of-play one for a reader with no warband. */
  warning: string;
  setting: Setting | undefined;
  campaignId: number;
  isMobile: boolean;
  canBuy: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onGet: () => void;
  onSaved: (item: Item) => void;
  onDeleted: () => void;
};

/**
 * An item's card in Wargear (the items rebuild): the flavour, the figures, each rule tagged
 * "shared rule" or "this item" with its D6 tables, who can buy each price row (the warband's own
 * picked out), where it comes from with a link to its page, and Get this item and Edit.
 */
export default function WargearDetail(props: WargearDetailProps) {
  const { item, offer, setting } = props;
  const beast = beastOf(item);
  const rows = item.availabilities ?? [];
  const chosen = rows.find((row) => row.id === offer?.availability_id) ?? rows[0] ?? null;
  const facts = [
    ...(item.range ? [{ label: "Range", value: item.range }] : []),
    ...(item.strength ? [{ label: "Strength", value: item.strength }] : []),
    ...(item.save ? [{ label: "Save", value: item.save }] : []),
    ...(chosen ? [{ label: "Cost", value: priceLabel(chosen) }] : []),
    ...(chosen ? [{ label: "Rarity", value: rarityLabel(chosen.rarity) }] : []),
  ];
  const profile = beast?.has_profile ? beast : null;
  const table = profile ? null : statblockTable(item.statblock);
  const source = sourceLine(item, setting);
  let edit: ReactNode = null;
  if (props.canEdit && beast) {
    edit = (
      <Link
        to={beastEditLink(props.campaignId, beast.id)}
        className="text-[13px] font-semibold text-accent-text hover:text-accent-hi"
      >
        Edit {beast.name} in the Bestiary
      </Link>
    );
  } else if (props.canEdit) {
    edit = (
      <ItemFormDialog
        mode="edit"
        item={item}
        campaignId={props.campaignId}
        canDelete={props.canDelete}
        onUpdated={props.onSaved}
        onDeleted={props.onDeleted}
        trigger={
          <Button variant="secondary" className="min-h-10 self-start">
            Edit item
          </Button>
        }
      />
    );
  }
  const aside = (
    <>
      {props.canBuy && chosen && isSold(item) ? (
        <Button className="min-h-11 w-full" onClick={props.onGet}>
          Get this item
        </Button>
      ) : null}
      <DetailSection title="Who can buy">
        {rows.length ? (
          rows.map((row) => (
            <PriceRow
              key={row.id}
              row={row}
              chosen={Boolean(offer?.can_buy) && row.id === offer?.availability_id}
            />
          ))
        ) : (
          <span className="text-[13px] text-text2">Not sold.</span>
        )}
      </DetailSection>
      {source || item.link_url ? (
        <DetailSection title="Source">
          {source ? <span className="text-[13px] text-ink">{source}</span> : null}
          {item.link_url ? (
            <a
              href={item.link_url}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] font-semibold text-accent-text hover:text-accent-hi"
            >
              Open its page
            </a>
          ) : null}
        </DetailSection>
      ) : null}
      {item.notes ? (
        <DetailSection title="Notes">
          <span className="whitespace-pre-line text-[13px] text-text2">{item.notes}</span>
        </DetailSection>
      ) : null}
      {edit}
    </>
  );
  return (
    <ReferenceDetail
      title={itemName(item)}
      kind={kindOf(item)}
      isMobile={props.isMobile}
      aside={aside}
    >
      {props.warning ? (
        <div className="self-start border border-dashed border-danger-line px-2.5 py-1.5 text-[13px] text-danger">
          {props.warning}
        </div>
      ) : null}
      {item.flavour?.trim() ? <Flavour>{item.flavour}</Flavour> : null}
      {props.isMobile ? null : <FactLine facts={facts} />}
      {profile ? <ProfileStrip profile={profile} /> : null}
      {table ? <RuleTableView table={table} /> : null}
      {item.rules?.length || beast?.specials?.length ? (
        <div className="flex flex-col gap-2.5">
          {(item.rules ?? []).map((rule) => (
            <ItemRuleBlock key={rule.id} rule={rule} />
          ))}
          {(beast?.specials ?? []).map((special) => (
            <RuleBlock key={`special-${special.id}`} name={special.name}>
              {special.description}
            </RuleBlock>
          ))}
        </div>
      ) : null}
    </ReferenceDetail>
  );
}
