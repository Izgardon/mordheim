import { useEffect, useMemo, useState } from "react";

import type { BattleParticipant } from "@/features/battles/types/battle-types";

/**
 * Whose roster a phase page shows (prebattle, active): your own at first, then whichever warband
 * the player picks. `statusParticipants` lists yours first.
 */
export function useParticipantSelection(
  participants: BattleParticipant[],
  currentUserId: number | undefined
) {
  const [selectedParticipantUserId, setSelectedParticipantUserId] = useState<number | null>(null);

  const currentParticipant = useMemo(
    () => participants.find((participant) => participant.user.id === currentUserId) ?? null,
    [participants, currentUserId]
  );

  useEffect(() => {
    if (participants.length === 0) {
      setSelectedParticipantUserId(null);
      return;
    }
    if (
      selectedParticipantUserId !== null &&
      participants.some((participant) => participant.user.id === selectedParticipantUserId)
    ) {
      return;
    }
    setSelectedParticipantUserId(currentParticipant?.user.id ?? participants[0].user.id);
  }, [participants, currentParticipant, selectedParticipantUserId]);

  const selectedParticipant = useMemo(() => {
    if (participants.length === 0) {
      return null;
    }
    const bySelection = participants.find(
      (participant) => participant.user.id === selectedParticipantUserId
    );
    return bySelection ?? currentParticipant ?? participants[0];
  }, [participants, currentParticipant, selectedParticipantUserId]);

  const selectedParticipantIsCurrentUser = Boolean(
    selectedParticipant &&
      currentParticipant &&
      selectedParticipant.user.id === currentParticipant.user.id
  );

  const statusParticipants = useMemo(() => {
    if (!currentUserId) {
      return participants;
    }
    const mine = participants.find((participant) => participant.user.id === currentUserId);
    if (!mine) {
      return participants;
    }
    return [mine, ...participants.filter((participant) => participant.user.id !== currentUserId)];
  }, [participants, currentUserId]);

  return {
    currentParticipant,
    selectedParticipant,
    selectedParticipantUserId,
    setSelectedParticipantUserId,
    selectedParticipantIsCurrentUser,
    statusParticipants,
  };
}
