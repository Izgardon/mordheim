import type { CampaignActiveBattle } from "../../types/campaign-types";
import {
  battleStatusLine,
  battleTypeLabel,
  formatCreatedAt,
  participantStatusLabel,
} from "./active-battle-labels";

type ActiveBattleDetailsProps = {
  entry: CampaignActiveBattle;
  columnCount: number;
  isMobile: boolean;
};

/** An expanded Active Battles row: type, status and age on phones, then every participant. */
export default function ActiveBattleDetails({
  entry,
  columnCount,
  isMobile,
}: ActiveBattleDetailsProps) {
  const { battle } = entry;
  return (
    <tr>
      <td
        colSpan={columnCount}
        className="border-b border-border/40 bg-background/20 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3"
      >
        <div className="space-y-3">
          {isMobile ? (
            <div className="grid gap-2 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Type:</span>{" "}
                {battleTypeLabel(battle.flow_type)}
              </p>
              <p>
                <span className="font-semibold text-foreground">Status:</span>{" "}
                {battleStatusLine(battle, entry.idle_seconds)}
              </p>
              <p>
                <span className="font-semibold text-foreground">Created:</span>{" "}
                {formatCreatedAt(battle.created_at)}
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              Participants
            </p>
            <div className="grid gap-2">
              {entry.participants.map((participant) => (
                <div
                  key={participant.id}
                  className="rounded-xl border border-border/50 bg-black/20 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-foreground">{participant.user.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {participant.warband.name} • {participantStatusLabel(participant.status)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
