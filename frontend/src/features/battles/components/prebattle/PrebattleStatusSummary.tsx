import { CardBackground } from "@/components/ui/card-background";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type PrebattleStatusSummaryProps = {
  participants: BattleParticipant[];
  getStatusLabel: (status: BattleParticipant["status"]) => string;
  getParticipantRating?: (participant: BattleParticipant) => number | null;
  selectedParticipantUserId?: number | null;
  onSelectParticipant?: (participantUserId: number) => void;
};

export default function PrebattleStatusSummary({
  participants,
  getStatusLabel,
  getParticipantRating,
  selectedParticipantUserId,
  onSelectParticipant,
}: PrebattleStatusSummaryProps) {
  return (
    <CardBackground className="space-y-2 p-2.5 sm:p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
        Battle Status
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {participants.map((participant) => {
          const isSelected = selectedParticipantUserId === participant.user.id;
          return (
            <button
              key={participant.id}
              type="button"
              onClick={() => onSelectParticipant?.(participant.user.id)}
              className={`rounded-lg border px-2.5 py-2 text-left transition ${
                isSelected
                  ? "border-amber-300/70 bg-amber-900/20"
                  : "border-border/40 bg-black/30 hover:border-amber-300/40"
              }`}
            >
              <p className="truncate text-xs font-semibold text-foreground sm:text-sm">{participant.user.label}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground sm:text-xs">{participant.warband.name}</p>
              <p className="mt-1 text-[0.58rem] uppercase tracking-[0.18em] text-amber-300 sm:text-[0.65rem]">
                {getStatusLabel(participant.status)}
              </p>
              <p className="mt-1 text-[0.55rem] text-muted-foreground sm:text-[0.6rem]">
                Rating: {getParticipantRating ? (getParticipantRating(participant) ?? "-") : (participant.declared_rating ?? "-")}
              </p>
            </button>
          );
        })}
      </div>
    </CardBackground>
  );
}
