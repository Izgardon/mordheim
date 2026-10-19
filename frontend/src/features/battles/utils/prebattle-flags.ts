import type {
  BattleCapabilities,
  BattleParticipant,
  BattleState,
} from "@/features/battles/types/battle-types";

/**
 * What the prebattle page offers you, from the battle, your row, what is in flight and the
 * server's capabilities (start, cancel); without capabilities, the creator's own rules.
 */
export function prebattleFlags({
  battleState,
  capabilities,
  currentParticipant,
  userId,
  isOwnSelected,
  isUpdatingReady,
  isSavingConfig,
  isStartingBattle,
}: {
  battleState: BattleState;
  capabilities: BattleCapabilities | null;
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
  const mayStart = capabilities
    ? capabilities.start
    : isBattleCreator && allParticipantsReady && status === "prebattle";

  return {
    currentUserReady,
    allParticipantsReady,
    invitePending,
    canAcceptInvite,
    waitingForOthers,
    isBattleCreator,
    canDeclineInvite: invitePending && !isBattleCreator && (canAcceptInvite || waitingForOthers),
    canCreatorCancelBattle: capabilities
      ? capabilities.cancel
      : isBattleCreator && (status === "inviting" || status === "prebattle"),
    // The creator sees Start (greyed out until everyone is ready), and so does anyone else the
    // server lets start.
    showStart: isBattleCreator || mayStart,
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
    startDisabled: !mayStart || isStartingBattle,
  };
}
