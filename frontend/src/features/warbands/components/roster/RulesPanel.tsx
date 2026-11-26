import { X } from "lucide-react";

import { BOX_TRIM, type BoxTileKind } from "@/components/ui/box-tile";
import { IconButton } from "@/components/ui/icon-button";
import type { Item } from "@/features/items/types/item-types";
import { ProfileStrip, type CatalogueProfile } from "@/features/reference/profile";
import PsychologyRuleLink from "@/features/rules/components/PsychologyRuleLink";

import { cn } from "@/lib/utils";

import ItemActionRow, { type ItemActions } from "./ItemActionRow";
import { isGroup, type RosterUnit } from "./unit-view";

/** What a box shows when opened: its name, a kind line and its rules text. */
export type BoxDetail = {
  name: string;
  kind: string;
  text?: string | null;
  /** An item's rules, each read out: the fluff is not one of them (William, 12 Nov 2026). */
  rules?: { name: string; text: string }[];
  /** An Animal item's beast's profile (its specials are among `rules`). */
  profile?: CatalogueProfile | null;
  item?: Item;
  /** A special: a psychology one links its part of the Rules page ("Fear in the rules"). */
  special?: boolean;
  /** Its box's kind, whose colour the panel's border takes. */
  boxKind?: BoxTileKind;
};

type RulesPanelProps = {
  detail: BoxDetail;
  onClose: () => void;
  /** The unit carrying it and what can be done with it; omitted when the viewer can't act. */
  itemActions?: ItemActions & { owner: RosterUnit };
};

/**
 * A box's rules under its row; for an item its actions come first, in one row above its rules
 * (William, 25 Nov 2026).
 */
export default function RulesPanel({ detail, onClose, itemActions }: RulesPanelProps) {
  // a group sells a loadout row: a copy for each member who carries it (henchmen loadouts)
  const copies = itemActions && isGroup(itemActions.owner) ? (detail.item?.carriers ?? 1) : 1;
  const suggested = (detail.item?.suggested_sale_price ?? detail.item?.cost ?? 0) * copies;

  return (
    <div
      data-trim={detail.boxKind ?? "item"}
      className={cn("flex flex-col gap-2 border bg-panel p-3", BOX_TRIM[detail.boxKind ?? "item"])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-bold text-head">{detail.name}</span>
          <span className="text-xs text-muted-foreground">{detail.kind}</span>
        </div>
        <IconButton aria-label="Close rules" look="plain" className="h-8 w-8" onClick={onClose}>
          <X aria-hidden="true" />
        </IconButton>
      </div>
      {itemActions && detail.item ? (
        <ItemActionRow actions={itemActions} suggested={suggested ?? 0} />
      ) : null}
      {detail.profile ? <ProfileStrip profile={detail.profile} /> : null}
      {detail.rules?.map((rule) => (
        <p key={rule.name} className="m-0 whitespace-pre-line text-[13px] text-text2">
          <span className="font-bold text-accent-hi">{rule.name}</span>
          {rule.text ? ` · ${rule.text}` : ""}
        </p>
      ))}
      {detail.text ? (
        <p className="whitespace-pre-line text-[13px] text-text2">{detail.text}</p>
      ) : null}
      {detail.special ? <PsychologyRuleLink specialName={detail.name} /> : null}
    </div>
  );
}
