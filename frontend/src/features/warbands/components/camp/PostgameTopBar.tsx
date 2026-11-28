import type { ReactNode } from "react";

import { usePostgameBattle, type PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";

import type { PostgameSource } from "./camp-types";
import PostgameBar from "./PostgameBar";
import { useCampState, useFoundPostgame } from "./use-camp";

type TopBarProps = {
  source: PostgameSource;
  /** What the bar shows when you have no open post-game here after all (the rejoin banner). */
  fallback: ReactNode;
};

function OpenDraft({
  props,
  battle,
  battleState,
  me,
}: {
  props: TopBarProps;
  battle: PostgameBattle;
  battleState: BattleState;
  me: BattleParticipant;
}) {
  const camp = useCampState(props.source, battle, battleState, me);
  return camp ? <PostgameBar camp={camp} /> : null;
}

function Loaded({ props, battleId }: { props: TopBarProps; battleId: number }) {
  const battle = usePostgameBattle(props.source.campaignId, battleId);
  const { battleState, participant } = battle;
  if (!battleState || !participant || !battle.roster) return null;
  // once you are ready the aftermath is done for you: the bar shows what else waits, if anything
  if (participant.status === "confirmed_postbattle") return <>{props.fallback}</>;
  return <OpenDraft props={props} battle={battle} battleState={battleState} me={participant} />;
}

/**
 * The web's top bar on your warband page while your post-game is open (William, 28 Nov 2026: "so
 * the steps are always in the top line"): the battle and its result, the steps and To the
 * aftermath, in place of the rejoin banner (your other open battles stay on the rail's Battles).
 * It finds the post-game as camp does and shares its cached battle and draft.
 */
export default function PostgameTopBar(props: TopBarProps) {
  const battleId = useFoundPostgame(props.source);
  if (battleId === undefined) return null;
  return battleId ? <Loaded props={props} battleId={battleId} /> : <>{props.fallback}</>;
}
