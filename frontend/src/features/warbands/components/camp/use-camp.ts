import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";

import { opponentsOf, resultText } from "@/features/battles/components/aftermath/AftermathAside";
import { useOpenCampaignBattles } from "@/features/battles/hooks/useOpenCampaignBattles";
import type { PostgameBattle } from "@/features/battles/hooks/usePostgameBattle";
import { usePostgameDraft } from "@/features/battles/hooks/usePostgameDraft";
import type { BattleParticipant, BattleState } from "@/features/battles/types/battle-types";
import { openBattleTitle } from "@/features/battles/utils/open-battles";

import { warbandTreasuryQuery } from "../../api/economy-queries";
import type { HenchmenGroup, WarbandHireling, WarbandTrade } from "../../types/warband-types";
import type { CampRow, CampState, PostgameSource } from "./camp-types";

/** The players a post-game shows for: still in it, or ready and waiting for the others. */
export const SHOWN = new Set(["finished_battle", "confirmed_postbattle"]);

/** A purchase in the ledger: a Buy row, or a batch's group with Buy rows under it. */
const isBuy = (row: WarbandTrade) =>
  row.action === "Buy" || row.children.some((child) => child.action === "Buy");

/** Whether the ledger's newest rows hold a purchase made since `since` (you finished your fight). */
function boughtSince(rows: WarbandTrade[], since: string | null | undefined) {
  const from = since ? Date.parse(since) : NaN;
  return (
    !Number.isNaN(from) && rows.some((row) => isBuy(row) && Date.parse(row.created_at) >= from)
  );
}

/**
 * Your open post-game in the campaign's open battles, for your own warband: its battle id, null
 * when there is none, undefined while the list loads.
 */
export function useFoundPostgame(source: PostgameSource) {
  const open = useOpenCampaignBattles(source.campaignId, { enabled: source.enabled });
  if (!source.enabled) return null;
  if (!open.data) return undefined;
  const found = open.data.find(
    (entry) =>
      entry.battle.status !== "ended" &&
      entry.battle.status !== "canceled" &&
      entry.participants.some(
        (p) =>
          p.user.id === source.userId && p.warband.id === source.warbandId && SHOWN.has(p.status)
      )
  );
  return found ? found.battle.id : null;
}

/**
 * An open post-game's draft, sheet and camp record, as the bar and camp read it (null until the
 * draft is in). The bar and camp share the cached battle and draft, so two cost no extra request.
 */
export function useCampState(
  source: PostgameSource,
  battle: PostgameBattle,
  battleState: BattleState,
  me: BattleParticipant
): CampState | null {
  const { campaignId } = source;
  const postgame = usePostgameDraft({
    campaignId,
    battleId: battleState.battle.id,
    battle,
    battleState,
    participant: me,
  });
  const [params, setParams] = useSearchParams();
  const ledger = useInfiniteQuery(warbandTreasuryQuery(campaignId, source.warbandId));
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
  return {
    ...source,
    battleState,
    me,
    postgame,
    draft,
    save: postgame.drafting.persistDraft,
    title: openBattleTitle(battleState.battle),
    subtitle: `${resultText(battleState, me.warband.id, me.declared_result)}${opponents.length ? ` against ${opponents.join(", ")}` : ""}`,
    aftermathPath: `/campaigns/${campaignId}/battles/${battleState.battle.id}/postbattle`,
    gold: sheet?.summary.gold ?? sheet?.warband.gold ?? 0,
    groups: (sheet?.henchmen_groups ?? []) as HenchmenGroup[],
    hirelings: (sheet?.hirelings ?? []) as WarbandHireling[],
    resources: sheet?.summary.resources ?? [],
    bought: boughtSince(ledger.data?.pages[0]?.results ?? [], me.finished_at),
    focus: params.get("camp"),
    setCamp,
  };
}
