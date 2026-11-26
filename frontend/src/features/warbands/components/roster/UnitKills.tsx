import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { GameIcon } from "@/components/ui/game-icons";
import { IconButton } from "@/components/ui/icon-button";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";

import { unitApi } from "../../units/unit-api";
import { BADGE } from "./badge-style";
import { isGroup, killLine, unitKey, type RosterUnit } from "./unit-view";

/** A unit's kills: its counter, or a henchmen group's members' together. */
export function unitKillCount(entry: RosterUnit) {
  if (isGroup(entry))
    return entry.unit.henchmen.reduce((sum, member) => sum + (member.kills ?? 0), 0);
  return entry.unit.kills ?? 0;
}

/** Each kill the unit scored in the campaign's ended battles, newest first; read when shown. */
function KillList({
  campaignId,
  warbandId,
  entry,
  by,
}: {
  campaignId: number;
  warbandId: number;
  entry: RosterUnit;
  /** One member of a group: only the kills that model scored. */
  by?: string;
}) {
  const history = useQuery({
    queryKey: queryKeys.campaign.unitKills(campaignId, warbandId, unitKey(entry)),
    queryFn: () => unitApi(entry.kind).killHistory(warbandId, entry.unit.id),
    staleTime: 30_000,
  });
  const kills = (history.data?.kills ?? []).filter((kill) => by === undefined || kill.by === by);
  if (history.isPending)
    return <span className="text-[13px] text-muted-foreground">Reading the kills…</span>;
  if (history.isError)
    return <span className="text-[13px] text-danger">Couldn't read the kills.</span>;
  if (!kills.length)
    return <span className="text-[13px] text-text2">No kill in an ended battle.</span>;
  return (
    <ol className="m-0 flex max-h-72 list-none flex-col overflow-y-auto overscroll-contain p-0">
      {kills.map((kill) => (
        <li
          key={kill.id}
          className="border-t border-line py-1.5 text-[13px] text-ink first:border-t-0 first:pt-0"
        >
          {killLine(kill)}
        </li>
      ))}
    </ol>
  );
}

/**
 * The kill count on an open card (William: "just display a number that is clickable for a
 * breakdown"): "Kills 3", which opens the kill history in a popover on the web, a sheet on a
 * phone. A henchmen group's are its members', each kill naming the model.
 */
export default function UnitKills({
  campaignId,
  warbandId,
  entry,
  align = "end",
  member,
}: {
  campaignId: number;
  warbandId: number;
  entry: RosterUnit;
  /** The side of the count its web popover lines up with: its left edge on a card's left. */
  align?: "start" | "end";
  /** One member of a henchmen group (the members list): their count and their own kills. */
  member?: { name: string; kills: number };
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const box = useRef<HTMLSpanElement>(null);
  const count = member ? member.kills : unitKillCount(entry);
  const name = member ? member.name : entry.unit.name;

  useEffect(() => {
    if (!open || isMobile) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => (event.key === "Escape" ? setOpen(false) : undefined);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open, isMobile]);

  if (!count) return null;
  const list = (
    <KillList campaignId={campaignId} warbandId={warbandId} entry={entry} by={member?.name} />
  );
  return (
    <span ref={box} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Kills ${count}: the breakdown`}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          BADGE,
          "inline-flex items-center gap-1.5 border border-border text-ink hover:bg-raised"
        )}
      >
        <GameIcon name="kills" className="h-3.5 w-3.5 text-danger" />
        <span className="font-mono">{count}</span>
      </button>
      {open && isMobile ? (
        <BottomSheet open onOpenChange={setOpen} kicker="Kills" title={name}>
          {list}
        </BottomSheet>
      ) : open ? (
        <div
          role="dialog"
          aria-label={`Kills of ${name}`}
          className={cn(
            "absolute top-full z-30 mt-1 flex w-[min(24rem,80vw)] flex-col gap-2 border border-accent-line bg-panel p-3 text-left shadow-[0_16px_40px_var(--color-shadow)]",
            align === "start" ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
              Kills · {count}
            </span>
            <IconButton
              aria-label="Close"
              look="plain"
              className="h-8 w-8"
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>
          {list}
        </div>
      ) : null}
    </span>
  );
}
