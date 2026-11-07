import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  DetailSection,
  FactLine,
  Flavour,
  ReferenceDetail,
} from "@/features/reference/ReferenceDetail";

import ItemFormDialog from "../components/ItemFormDialog";
import ItemRules, { itemFacts } from "../components/ItemRules";
import { itemName, kindOf } from "../store/store-items";
import type { Item, ItemAvailability, ItemOffer } from "../types/item-types";
import { longCostNote, priceLabel, rarityLabel, whoLine } from "../utils/item-prices";
import { beastEditLink, beastOf, isSold } from "../utils/item-listing";

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
 * An item's card in Wargear (the items rebuild): the flavour, the figures, each rule (a shared one
 * tagged "shared rule", the item's own unnamed one under the item's name) with its D6 tables, who
 * can buy each price row (the warband's own picked out), where it comes from with a link to its
 * page, and Get this item and Edit.
 */
export default function WargearDetail(props: WargearDetailProps) {
  const { item, offer, setting } = props;
  const beast = beastOf(item);
  const rows = item.availabilities ?? [];
  const chosen = rows.find((row) => row.id === offer?.availability_id) ?? rows[0] ?? null;
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
      {props.isMobile ? null : <FactLine facts={itemFacts(item, chosen)} />}
      <ItemRules item={item} />
    </ReferenceDetail>
  );
}
