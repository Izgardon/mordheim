import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { opponentsOf, resultText } from "@/features/battles/components/aftermath/AftermathAside";
import { useOpenCampaignBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import { usePostgameBattle, type PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import { usePostgameDraft } from "@/features/battles/hooks/usePostgameDraft";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";

import type { HenchmenGroup, WarbandHireling } from "../../types/warband-types";
import CampAside from "./CampAside";
import type { CampRow, OpenCamp, PostgameSlotProps } from "./camp-types";
import PostgameBar from "./PostgameBar";
import ReadyCard from "./ReadyCard";

const SHOWN = new Set(["finished_battle", "confirmed_postbattle"]);

/** Camp and the ready card sit in the web's sidebar beside the roster; on a phone at the top. */
const inAside = (props: PostgameSlotProps, node: ReactNode) =>
  props.slot === "aside" && !props.isMobile ? (
    <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">{node}</aside>
  ) : (
    node
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
  const { campaignId } = props;
  const postgame = usePostgameDraft({
    campaignId,
    battleId: battleState.battle.id,
    battle,
    battleState,
    participant: me,
  });
  const [params, setParams] = useSearchParams();
  const draft = postgame.drafting.draft;
  if (!draft) return null;
  const setCamp = (row: CampRow | "ready" | null) => {
    const next = new URLSearchParams(params);
    if (row) next.set("camp", row);
    else next.delete("camp");
    setParams(next, { replace: true });
  };
  const opponents = opponentsOf(battleState, me);
  const sheet = postgame.sheet;
  const camp: OpenCamp = {
    ...props,
    battleState,
    me,
    postgame,
    draft,
    save: postgame.drafting.persistDraft,
    subtitle: `${resultText(battleState, me.warband.id, me.declared_result)}${opponents.length ? ` against ${opponents.join(", ")}` : ""}`,
    aftermathPath: `/campaigns/${campaignId}/battles/${battleState.battle.id}/postbattle`,
    gold: sheet?.summary.gold ?? sheet?.warband.gold ?? 0,
    groups: (sheet?.henchmen_groups ?? []) as HenchmenGroup[],
    hirelings: (sheet?.hirelings ?? []) as WarbandHireling[],
    focus: params.get("camp"),
    setCamp,
  };
  return props.slot === "bar" ? (
    <PostgameBar camp={camp} />
  ) : (
    inAside(props, <CampAside camp={camp} />)
  );
}

function Loaded({ props, battleId }: { props: PostgameSlotProps; battleId: number }) {
  const battle = usePostgameBattle(props.campaignId, battleId);
  const { battleState, participant } = battle;
  if (!battleState || !participant || !battle.roster) return null;
  if (participant.status === "confirmed_postbattle") {
    if (props.slot === "bar") return null;
    const playing = battleState.participants.filter((entry) => SHOWN.has(entry.status));
    const ready = playing.filter((entry) => entry.status === "confirmed_postbattle").length;
    return inAside(props, <ReadyCard ready={ready} total={playing.length} />);
  }
  return <OpenDraft props={props} battle={battle} battleState={battleState} me={participant} />;
}

/**
 * The warband page's post-game (design E), in one of its places: the web's bar above the page,
 * the camp beside the roster (the phone's post-game card), or, once you are ready, the card that
 * says so. Each finds your open post-game in the campaign's open battles; they share the cached
 * battle and the draft, so placing two costs no extra request.
 */
export default function PostgameSlot(props: PostgameSlotProps) {
  const open = useOpenCampaignBattles(props.campaignId, { enabled: props.enabled });
  const found = props.enabled
    ? open.data?.find(
        (entry) =>
          entry.battle.status !== "ended" &&
          entry.battle.status !== "canceled" &&
          entry.participants.some(
            (p) =>
              p.user.id === props.userId && p.warband.id === props.warbandId && SHOWN.has(p.status)
          )
      )
    : undefined;
  return found ? <Loaded props={props} battleId={found.battle.id} /> : null;
}
