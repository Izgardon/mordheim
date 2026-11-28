import type { MouseEvent, ReactNode } from "react";
import { ChevronDown, ChevronsUp, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GameIcon } from "@/components/ui/game-icons";
import { IconButton } from "@/components/ui/icon-button";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { cn } from "@/lib/utils";

import { useItemLabel } from "../../hooks/units/useItemLabel";
import UnitBadges, { hasBadges, UnitTradingAction } from "./UnitBadges";
import UnitKills from "./UnitKills";
import UnitLines from "./UnitLines";
import UnitProfile from "./UnitProfile";
import UnitPendingPicks, { type OnPendingPick } from "./UnitPendingPicks";
import UnitTitle from "./UnitTitle";
import UnitWarnings from "./UnitWarnings";
import {
  buysItems,
  isGroup,
  KIND_TRIM,
  liveMembers,
  statValues,
  unitDomId,
  xpInfo,
  type RosterUnit,
} from "./unit-view";

type UnitCardProps = {
  entry: RosterUnit;
  campaign: CampaignSummary | null;
  warbandId: number;
  open: boolean;
  /** Its Edit form is open: the card is only the form (no head). */
  editing?: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onLoadout: () => void;
  onEdit: () => void;
  onRide: (rowId: number, on: boolean) => void;
  /** Advance ready's button: the unit's advance. */
  onAdvance?: () => void;
  onTradingAction?: (on: boolean) => void;
  /** Its picks to choose, pressed: opens the card at the pick's box. */
  onPendingPick?: OnPendingPick;
  /** The open body (`UnitDetails`), or the edit form. */
  children?: ReactNode;
};

/** A click in the card's head that lands on none of its controls opens or closes the card. */
const CONTROLS = "button, a, input, select, textarea, label, [role=switch], [role=dialog]";

/**
 * Advance ready, centred on the card's top edge, half outside it (William: "on top, 50% or so
 * inside the card 50% outside centered so it is always top level visible and most prominent"),
 * open or closed; it pops in when the advance comes.
 */
const ADVANCE =
  "advance-pop absolute left-1/2 top-0 z-10 inline-flex min-h-[28px] -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap border border-primary bg-primary px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_4px_14px_var(--color-shadow)]";

/**
 * One unit of the roster (design E), the same card for every kind in the roster's grids (William,
 * 7 Nov 2026: "henchmen card blocks same as hero/hs not full width on warband page"): closed it
 * shows the profile and a line for each of his lists (a group's members, and what each carries),
 * open its boxes across the grid. The whole head (name, badges, profile, lines) opens and closes
 * it, not just the arrow.
 */
export default function UnitCard(props: UnitCardProps) {
  const { entry, campaign, open, canEdit } = props;
  const itemLabel = useItemLabel(campaign?.id ?? 0, props.warbandId);
  const trim = KIND_TRIM[entry.kind];
  // editing: no head (name, type, profile), straight into the form (William); on a phone the form
  // is a sheet, which portals out of the card
  if (props.editing) {
    return (
      <Card
        as="article"
        id={unitDomId(entry)}
        expanded
        className={cn(
          "col-span-full flex min-w-0 scroll-mt-24 flex-col p-3.5 max-[960px]:hidden",
          trim.stripe
        )}
      >
        {props.children}
      </Card>
    );
  }
  const { unit } = entry;
  const xp = xpInfo(entry, campaign);
  const stats = statValues(entry);
  const members = isGroup(entry) ? liveMembers(entry.unit) : [];
  const countText = isGroup(entry)
    ? `×${members.length}${open && entry.unit.max_size ? `/${entry.unit.max_size}` : ""}`
    : null;
  const headClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(CONTROLS)) return;
    props.onToggle();
  };

  const advance = xp?.advanceReady ? (
    canEdit && props.onAdvance ? (
      <button type="button" className={cn(ADVANCE, "hover:bg-accent-hi")} onClick={props.onAdvance}>
        <ChevronsUp className="h-3.5 w-3.5" aria-hidden="true" />
        Advance ready
      </button>
    ) : (
      <span className={ADVANCE}>
        <ChevronsUp className="h-3.5 w-3.5" aria-hidden="true" />
        Advance ready
      </span>
    )
  ) : null;

  const name = unit.name;
  // the badges and (open) kills sit on the row under the head, leaving the head to the name
  // (William, 22 Nov 2026): opposite a hero's trading action, beside a group's members; a hired
  // sword has no such row, so theirs stay in the head, his picks to choose on a line under it.
  // Closed, no kills; open, no picks to choose (the boxes show them).
  const badgesAt = entry.kind === "hero" ? "trading" : members.length ? "members" : "head";
  const picks = open ? null : (
    <UnitPendingPicks
      entry={entry}
      campaignId={campaign?.id ?? 0}
      line={badgesAt !== "trading"}
      onPick={canEdit ? props.onPendingPick : undefined}
    />
  );
  const badges = (
    <>
      <UnitBadges entry={entry} campaign={campaign} canEdit={canEdit} onRide={props.onRide} />
      {badgesAt === "trading" ? picks : null}
      {/* a henchmen group's kills sit on each member's line in the members list (William, 22 Nov 2026) */}
      {open && !isGroup(entry) ? (
        <UnitKills
          campaignId={campaign?.id ?? 0}
          warbandId={props.warbandId}
          entry={entry}
          align={entry.kind === "hero" ? "start" : "end"}
        />
      ) : null}
    </>
  );

  // open, Edit takes the Loadout's place (Add item is further down): the pencil alone on a phone
  const buttons = (
    <div className="flex shrink-0 items-center gap-1.5">
      {open && canEdit ? (
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Edit ${name}`}
          className="h-9 max-[960px]:w-9 max-[960px]:px-0"
          onClick={props.onEdit}
        >
          <Pencil aria-hidden="true" />
          <span className="max-[960px]:hidden">Edit</span>
        </Button>
      ) : null}
      {!open && buysItems(entry) ? (
        <IconButton
          aria-label={`Loadout of ${name}`}
          className="h-9 w-9 bg-page text-accent-text"
          onClick={props.onLoadout}
        >
          <GameIcon name="loadout" className="h-[18px] w-[18px]" />
        </IconButton>
      ) : null}
      <IconButton
        aria-label={open ? `Close ${name}` : `Open ${name}`}
        aria-expanded={open}
        className="h-9 w-9"
        onClick={props.onToggle}
      >
        <ChevronDown
          aria-hidden="true"
          className={cn("transition-transform", open && "rotate-180")}
        />
      </IconButton>
    </div>
  );

  return (
    <Card
      as="article"
      id={unitDomId(entry)}
      expanded={open}
      className={cn(
        "flex min-w-0 scroll-mt-24 flex-col gap-3 p-3.5",
        trim.stripe,
        open && "col-span-full"
      )}
    >
      {advance}
      <div className="flex cursor-pointer flex-col gap-3" onClick={headClick}>
        <div className="flex items-start gap-2.5">
          <div className="min-w-28 flex-1">
            <UnitTitle entry={entry} open={open} countText={countText} onToggle={props.onToggle} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {badgesAt === "head" ? badges : null}
            {buttons}
          </div>
        </div>
        {badgesAt === "trading" ? null : picks}
        <UnitTradingAction
          entry={entry}
          canEdit={canEdit}
          onTradingAction={props.onTradingAction}
          open={open}
          start={badgesAt === "trading" && (open || hasBadges(entry, campaign)) ? badges : null}
        />
        {members.length ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => (
                <span
                  key={member.id}
                  className="inline-flex min-h-[30px] items-center gap-1.5 border border-border bg-raised px-2.5 text-xs font-bold text-ink"
                >
                  {member.name}
                  {member.gaps?.length ? (
                    <span className="font-medium text-danger">lacks {member.gaps.length}</span>
                  ) : null}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
          </div>
        ) : null}
        <UnitProfile
          values={stats.values}
          highlighted={stats.highlighted}
          notes={open ? (unit.notes ?? "") : undefined}
        />
        <UnitWarnings warnings={"warnings" in unit ? unit.warnings : undefined} />
        {/* closed: his items, skills, spells and specials, a line each, and his XP */}
        {open ? null : (
          <UnitLines
            entry={entry}
            itemName={(item) => itemLabel(unit, item)}
            xpText={xp ? xp.text : "No XP"}
          />
        )}
      </div>
      {props.children}
    </Card>
  );
}
