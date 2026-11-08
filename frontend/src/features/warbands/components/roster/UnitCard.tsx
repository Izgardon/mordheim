import type { MouseEvent, ReactNode } from "react";
import { ChevronDown, ChevronsUp, Crown, PawPrint, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipLabel } from "@/components/ui/chip";
import { GameIcon } from "@/components/ui/game-icons";
import { IconButton } from "@/components/ui/icon-button";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { cn } from "@/lib/utils";

import { useItemLabel } from "../../hooks/units/useItemLabel";
import UnitBadges from "./UnitBadges";
import UnitLines from "./UnitLines";
import UnitProfile from "./UnitProfile";
import {
  isCreature,
  isGroup,
  KIND_TRIM,
  liveMembers,
  memberName,
  statValues,
  unitDomId,
  unitName,
  unitTypeLine,
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
  const creature = isCreature(entry);
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

  const buttons = (
    <div className="flex shrink-0 items-center gap-1.5">
      {open && canEdit ? (
        <Button size="sm" variant="secondary" className="h-9" onClick={props.onEdit}>
          <Pencil aria-hidden="true" />
          Edit
        </Button>
      ) : null}
      {creature ? null : (
        <IconButton
          aria-label={`Loadout of ${unitName(unit)}`}
          className="h-9 w-9 bg-page text-accent-text"
          onClick={props.onLoadout}
        >
          <GameIcon name="loadout" className="h-[18px] w-[18px]" />
        </IconButton>
      )}
      <IconButton
        aria-label={open ? `Close ${unitName(unit)}` : `Open ${unitName(unit)}`}
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

  const title = (
    <button
      type="button"
      aria-expanded={open}
      onClick={props.onToggle}
      className="flex min-w-0 flex-col gap-0.5 text-left"
    >
      <span className="flex flex-wrap items-center gap-2 font-display text-[19px] font-semibold text-head">
        <span className="inline-flex items-baseline gap-2">
          <span aria-hidden="true" className={trim.gem} />
          {unitName(unit)}
        </span>
        {"is_leader" in unit && unit.is_leader ? (
          <Crown className="h-[15px] w-[15px] text-accent-text" aria-label="Leader" />
        ) : null}
        {creature ? (
          <ChipLabel className="min-h-0 gap-1 px-1.5 py-px text-[11px]">
            <PawPrint className="h-3 w-3" aria-hidden="true" />
            Creature
          </ChipLabel>
        ) : null}
      </span>
      <span className={cn("text-[13px]", trim.text)}>
        {unitTypeLine(entry)}
        {countText ? <span className="ml-1.5 font-mono">{countText}</span> : null}
      </span>
    </button>
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
          <div className="min-w-28 flex-1">{title}</div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <UnitBadges
              entry={entry}
              campaign={campaign}
              warbandId={props.warbandId}
              canEdit={canEdit}
              onRide={props.onRide}
              onTradingAction={props.onTradingAction}
            />
            {buttons}
          </div>
        </div>
        {members.length ? (
          <div className="flex flex-wrap gap-1.5">
            {members.map((member) => (
              <span
                key={member.id}
                className="inline-flex min-h-[30px] items-center gap-1.5 border border-border bg-raised px-2.5 text-xs font-bold text-ink"
              >
                {isGroup(entry) ? memberName(entry.unit, member) : member.name}
                {member.gaps?.length ? (
                  <span className="font-medium text-danger">lacks {member.gaps.length}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
        <UnitProfile
          values={stats.values}
          highlighted={stats.highlighted}
          notes={open ? (unit.notes ?? "") : undefined}
        />
        {/* closed: his items, skills, spells and boons & banes, a line each, and his XP */}
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
