import { useCallback, useEffect, useMemo, useState } from "react";

import type { PrebattleUnit } from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleParticipant } from "@/features/battles/types/battle-types";
import { parseDeclaredRating, statusRatings } from "@/features/battles/utils/prebattle-config";

/**
 * Warband ratings in prebattle: the inputs as typed (each starts from the declared rating), your
 * own rating as Ready Up saves it, and each participant's rating as the status shows it.
 */
export function usePrebattleRatings(
  participants: BattleParticipant[],
  currentParticipant: BattleParticipant | null,
  ownCustomUnits: PrebattleUnit[]
) {
  const [ratingInputsByUserId, setRatingInputsByUserId] = useState<Record<number, string>>({});

  useEffect(() => {
    if (participants.length === 0) {
      setRatingInputsByUserId({});
      return;
    }
    setRatingInputsByUserId((prev) => {
      const next: Record<number, string> = {};
      for (const participant of participants) {
        const participantUserId = participant.user.id;
        if (participantUserId in prev) {
          next[participantUserId] = prev[participantUserId];
          continue;
        }
        const defaultRating = participant.declared_rating;
        next[participantUserId] = defaultRating === null ? "" : String(defaultRating);
      }
      return next;
    });
  }, [participants]);

  const currentDeclaredRating = useMemo(() => {
    if (!currentParticipant) {
      return null;
    }
    if (!(currentParticipant.user.id in ratingInputsByUserId)) {
      return currentParticipant.declared_rating;
    }
    return parseDeclaredRating(ratingInputsByUserId[currentParticipant.user.id] ?? "");
  }, [currentParticipant, ratingInputsByUserId]);

  const statusRatingByUserId = useMemo(
    () => statusRatings(participants, currentParticipant?.user.id, ownCustomUnits),
    [currentParticipant?.user.id, ownCustomUnits, participants]
  );

  const setRatingInput = useCallback((userId: number, value: string) => {
    setRatingInputsByUserId((prev) => ({ ...prev, [userId]: value.replace(/[^\d]/g, "") }));
  }, []);

  return { ratingInputsByUserId, currentDeclaredRating, statusRatingByUserId, setRatingInput };
}
