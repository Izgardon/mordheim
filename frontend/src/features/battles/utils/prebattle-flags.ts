import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";

/** What the prebattle page offers you, from the battle, your row and what is in flight. */
export function prebattleFlags({
  battleState,
  currentParticipant,
  userId,
  isOwnSelected,
  isUpdatingReady,
  isSavingConfig,
  isStartingBattle,
}: {
  battleState: BattleState;
  currentParticipant: BattleParticipant | null;
  userId: number | undefined;
  isOwnSelected: boolean;
  isUpdatingReady: boolean;
  isSavingConfig: boolean;
  isStartingBattle: boolean;
}) {
  const { status } = battleState.battle;
  const { participants } = battleState;
  const currentUserReady = currentParticipant?.status === "ready";
  const allParticipantsReady =
    participants.length > 0 && participants.every((participant) => participant.status === "ready");
  const invitePending = status === "inviting";
  const canAcceptInvite = invitePending && currentParticipant?.status === "invited";
  const waitingForOthers = invitePending && currentParticipant?.status === "accepted";
  const isBattleCreator = battleState.battle.created_by_user_id === userId;

  return {
    currentUserReady,
    allParticipantsReady,
    invitePending,
    canAcceptInvite,
    waitingForOthers,
    isBattleCreator,
    canDeclineInvite: invitePending && !isBattleCreator && (canAcceptInvite || waitingForOthers),
    canCreatorCancelBattle: isBattleCreator && (status === "inviting" || status === "prebattle"),
    canEditOwnConfig: Boolean(
      isOwnSelected &&
        currentParticipant &&
        !currentUserReady &&
        !isUpdatingReady &&
        !isSavingConfig &&
        status === "prebattle"
    ),
    readyDisabled:
      invitePending ||
      isUpdatingReady ||
      status !== "prebattle" ||
      !currentParticipant ||
      currentParticipant.status === "accepted" ||
      currentParticipant.status === "canceled_prebattle",
    startDisabled: !allParticipantsReady || status !== "prebattle" || isStartingBattle,
  };
}
