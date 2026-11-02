import type { MouseEvent, ReactNode } from "react";
import { ChevronDown, Crown, PawPrint, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipLabel } from "@/components/ui/chip";
import { GameIcon } from "@/components/ui/game-icons";
import { IconButton } from "@/components/ui/icon-button";
import { StatStrip } from "@/components/ui/stat-strip";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import { cn } from "@/lib/utils";

import { eachCarries, loadoutLine } from "../../units/loadout";
import UnitBadges from "./UnitBadges";
import {
  gearSummary,
  isCreature,
  isGroup,
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
  /** "hero": a card in the grid; "row": a henchmen group or hired sword across the row. */
  layout: "hero" | "row";
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
  /** More for the header beside the chips: a hero's bounties. */
  extra?: ReactNode;
  /** The open body (`UnitDetails`), or the edit form. */
  children?: ReactNode;
};

/** A click in the card's head that lands on none of its controls opens or closes the card. */
const CONTROLS = "button, a, input, select, textarea, label, [role=switch], [role=dialog]";

/**
 * One unit of the roster (design E): closed it shows the profile and its gear, open its boxes.
 * The whole head (name, badges, profile, gear line) opens and closes it, not just the arrow.
 */
export default function UnitCard(props: UnitCardProps) {
  const { entry, campaign, layout, open, canEdit } = props;
  // editing: no head (name, type, profile), straight into the form (William); on a phone the form
  // is a sheet, which portals out of the card
  if (props.editing) {
    return (
      <Card
        as="article"
        id={unitDomId(entry)}
        expanded
        className={cn(
          "flex min-w-0 scroll-mt-24 flex-col p-3.5 pl-[18px] max-[960px]:hidden",
          layout === "hero" && "col-span-full"
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
  const head = "flex cursor-pointer flex-col gap-3";

  const badges = (
    <UnitBadges
      entry={entry}
      campaign={campaign}
      warbandId={props.warbandId}
      open={open}
      canEdit={canEdit}
      onRide={props.onRide}
      onAdvance={props.onAdvance}
      onTradingAction={props.onTradingAction}
      extra={props.extra}
    />
  );

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
        {unitName(unit)}
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
      <span className="text-[13px] text-muted-foreground">
        {unitTypeLine(entry)}
        {countText ? <span className="ml-1.5 font-mono text-accent-text">{countText}</span> : null}
      </span>
    </button>
  );

  if (layout === "hero") {
    return (
      <Card
        as="article"
        id={unitDomId(entry)}
        expanded={open}
        className={cn(
          "flex min-w-0 scroll-mt-24 flex-col gap-3 p-3.5 pl-[18px]",
          open && "col-span-full"
        )}
      >
        <div className={head} onClick={headClick}>
          <div className="flex items-start gap-2.5">
            <div className="min-w-28 flex-1">{title}</div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {badges}
              {buttons}
            </div>
          </div>
          <StatStrip values={stats.values} highlighted={stats.highlighted} />
          {open ? null : (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-text2">
                {gearSummary(creature ? [] : unit.items)}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {xp ? xp.text : "No XP"}
              </span>
            </div>
          )}
        </div>
        {props.children}
      </Card>
    );
  }

  return (
    <Card
      as="article"
      id={unitDomId(entry)}
      expanded={open}
      className="flex min-w-0 scroll-mt-24 flex-col gap-3 p-3 pl-[18px]"
    >
      <div className={head} onClick={headClick}>
        <div className="grid gap-x-6 gap-y-2.5 min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="flex min-w-0 flex-col gap-2">
            {title}
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
            <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-end gap-2">
              <span className="mr-auto font-mono text-xs text-muted-foreground">
                {xp ? xp.text : "No XP"}
              </span>
              {buttons}
            </div>
            <StatStrip values={stats.values} highlighted={stats.highlighted} />
          </div>
        </div>
        {open ? null : isGroup(entry) && !creature ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-[13px] text-text2">{eachCarries(entry.unit)}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {loadoutLine(entry.unit)}
            </span>
          </div>
        ) : (
          <span className="text-[13px] text-text2">{gearSummary(creature ? [] : unit.items)}</span>
        )}
      </div>
      {props.children}
    </Card>
  );
}
