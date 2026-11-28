import type { ReactNode } from "react";

import { usePostgameBattle, type PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";

import CampAside from "./CampAside";
import type { PostgameSlotProps } from "./camp-types";
import ReadyCard from "./ReadyCard";
import { SHOWN, useCampState, useFoundPostgame } from "./use-camp";

/** Camp and the ready card sit in the web's sidebar beside the roster; on a phone at the top. */
const inAside = (props: PostgameSlotProps, node: ReactNode) =>
  props.isMobile ? (
    node
  ) : (
    <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">{node}</aside>
  );

function OpenDraft({
  props,
  battle,
  battleState,
  me,
}: {
  props: PostgameSlotProps;
  battle: PostgameBattle;
  battleState: BattleState;
  me: BattleParticipant;
}) {
  const camp = useCampState(props, battle, battleState, me);
  return camp ? inAside(props, <CampAside camp={{ ...camp, ...props }} />) : null;
}

function Loaded({ props, battleId }: { props: PostgameSlotProps; battleId: number }) {
  const battle = usePostgameBattle(props.campaignId, battleId);
  const { battleState, participant } = battle;
  if (!battleState || !participant || !battle.roster) return null;
  if (participant.status === "confirmed_postbattle") {
    const playing = battleState.participants.filter((entry) => SHOWN.has(entry.status));
    const ready = playing.filter((entry) => entry.status === "confirmed_postbattle").length;
    return inAside(props, <ReadyCard ready={ready} total={playing.length} />);
  }
  return <OpenDraft props={props} battle={battle} battleState={battleState} me={participant} />;
}

/**
 * The warband page's camp (design E): beside the roster on the web, the post-game card on a
 * phone, or, once you are ready, the card that says so. The web's steps sit in the top bar
 * (`PostgameTopBar`), which reads the same cached battle and draft.
 */
export default function PostgameSlot(props: PostgameSlotProps) {
  const battleId = useFoundPostgame(props);
  return battleId ? <Loaded props={props} battleId={battleId} /> : null;
}
