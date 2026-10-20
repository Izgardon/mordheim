import { Link } from "react-router-dom";

import { Checkbox } from "@/components/ui/checkbox";
import { idleLabel } from "@/features/battles/utils/battle-timing";

import { useCampaignCapabilities } from "../../capabilities";
import { activeBattlesPath } from "./StuckBattlesBanner";

import type { CampaignPlayer } from "../../types/campaign-types";

/** "In battle #40 (postbattle), idle 6 days" from the players' busy fields (decision 1). */
export function battleBusyLabel(player: CampaignPlayer) {
  const battle = player.battle_busy_battle_id
    ? `battle #${player.battle_busy_battle_id}`
    : "a battle";
  const phase = player.battle_busy_status ? ` (${player.battle_busy_status})` : "";
  const idle = idleLabel(player.battle_busy_last_activity_at);
  return `In ${battle}${phase}${idle ? `, ${idle}` : ""}`;
}

const BUSY_LABEL = "block truncate text-[0.65rem] uppercase tracking-[0.15em] text-amber-300";

type BattleParticipantPickerProps = {
  campaignId: number;
  players: CampaignPlayer[];
  creatorUserId: number;
  selectedUserIds: number[];
  onToggle: (userId: number) => void;
  /** Starting a battle greys busy players out (they can still be invited). */
  greyOutBusy: boolean;
  /** Selected players already in a battle, named in a warning under the list. */
  busyInvitees: CampaignPlayer[];
};

/** The players with a warband, each with their rating; you are always in. */
export default function BattleParticipantPicker({
  campaignId,
  players,
  creatorUserId,
  selectedUserIds,
  onToggle,
  greyOutBusy,
  busyInvitees,
}: BattleParticipantPickerProps) {
  // A battle manager can go and see the stuck battle (CAMP-NEW-05).
  const canReview = useCampaignCapabilities(campaignId, { read: false }).manage_battles;
  return (
    <>
      <div className="space-y-2">
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
          Participants
        </p>
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border/50 bg-black/30 p-3">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">No players with warbands available.</p>
          ) : (
            players.map((player) => (
              <div
                key={player.id}
                className={`grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border/40 bg-black/30 px-3 py-2 ${
                  player.battle_busy && greyOutBusy ? "opacity-60" : ""
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 text-left"
                  onClick={() => onToggle(player.id)}
                  disabled={player.id === creatorUserId}
                >
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {player.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {player.warband?.name ?? "No warband"}
                  </span>
                  {player.battle_busy && !canReview ? (
                    <span className={BUSY_LABEL}>{battleBusyLabel(player)}</span>
                  ) : null}
                </button>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[0.55rem] uppercase tracking-[0.15em] text-muted-foreground">
                      Rating
                    </span>
                    <span className="inline-flex h-6 w-10 items-center justify-center rounded border border-border/50 bg-background/60 text-xs text-foreground">
                      {typeof player.warband?.rating === "number"
                        ? Math.max(0, Math.round(player.warband.rating))
                        : "-"}
                    </span>
                  </div>
                  <Checkbox
                    checked={player.id === creatorUserId || selectedUserIds.includes(player.id)}
                    disabled={player.id === creatorUserId}
                    onChange={() => onToggle(player.id)}
                  />
                </div>
                {player.battle_busy && canReview ? (
                  // A link can't sit inside the toggle button, so it gets the row's second line.
                  <Link
                    to={activeBattlesPath(campaignId)}
                    className={`${BUSY_LABEL} col-span-2 -mt-2 underline underline-offset-2 hover:text-amber-100`}
                  >
                    {battleBusyLabel(player)}
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {greyOutBusy && busyInvitees.length > 0 ? (
        <p className="text-sm text-amber-300">
          {busyInvitees
            .map((player) => `${player.name} is ${battleBusyLabel(player).toLowerCase()}`)
            .join("; ")}
          . You can still invite them; they finish that battle when they can.
        </p>
      ) : null}
    </>
  );
}
