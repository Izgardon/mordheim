import { CardBackground } from "@/components/ui/card-background";
import type { BattleParticipant } from "@/features/battles/types/battle-types";

type PrebattleSelectedParticipantCardProps = {
  participant: BattleParticipant | null;
  statusLabel: string;
  rating: number | null;
};

export default function PrebattleSelectedParticipantCard({
  participant,
  statusLabel,
  rating,
}: PrebattleSelectedParticipantCardProps) {
  if (!participant) {
    return null;
  }

  return (
    <CardBackground className="p-2.5 sm:p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{participant.user.label}</p>
          <p className="truncate text-xs text-muted-foreground">{participant.warband.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[0.58rem] uppercase tracking-[0.16em] text-amber-300">{statusLabel}</p>
          <p className="text-[0.62rem] text-muted-foreground">Rating: {rating ?? "-"}</p>
        </div>
      </div>
    </CardBackground>
  );
}

