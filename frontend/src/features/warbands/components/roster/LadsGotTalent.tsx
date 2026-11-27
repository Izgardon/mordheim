import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { talentSkillListsQuery } from "../../api/warbands-henchmen";
import { promoteHenchman } from "../../hooks/units/promote-henchman";
import type { HenchmenGroup, WarbandHero } from "../../types/warband-types";
import { toastServerWarnings } from "../../utils/server-warnings";
import { buildHenchmenOptions } from "../../utils/levelup-utils";
import TalentSkillLists from "./TalentSkillLists";

/**
 * The lad's got talent (a henchmen roll of 10–12; William: "after rolling you should see the
 * henchmen names and then click a henchman then lock in promote"): the member who joins the
 * heroes, the skill lists he takes from the heroes' (William, 27 Nov 2026) and, at the hero cap,
 * a hero to dismiss to make room. Promote makes him a hero with an
 * advance to take later on his card ("we dont then level up that new hero then and there"); the
 * group keeps its level-up, so the dialog then offers its roll again (`onPromoted`).
 */
export default function LadsGotTalent({
  group,
  campaignId,
  warbandId,
  heroes,
  maxHeroes,
  onPromoted,
}: {
  group: HenchmenGroup;
  campaignId: number;
  warbandId: number;
  heroes: WarbandHero[];
  maxHeroes: number | null;
  /** Promoted: `groupLeft` when he was its last member, so there is no roll left to make. */
  onPromoted: (groupLeft: boolean) => void;
}) {
  const updateCache = useWarbandCacheUpdate();
  const members = buildHenchmenOptions({
    ...group,
    henchmen: group.henchmen.filter((member) => !member.dead),
  });
  const [memberId, setMemberId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<number | null>(null);
  const [lists, setLists] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const offer = useQuery(talentSkillListsQuery(campaignId, warbandId, group.id));
  const pick = offer.data?.pick ?? 0;
  const atCap = maxHeroes !== null && heroes.length >= maxHeroes;
  const chosen = members.find((member) => member.id === memberId);
  const listsReady = !offer.isLoading && lists.length >= pick;

  const promote = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const result = await promoteHenchman({
        warbandId,
        group,
        selectedHenchmanId: memberId,
        skillLists: lists,
        ...(atCap && dismissId !== null ? { dismissHeroId: dismissId } : {}),
      });
      if (result === "not-found") throw new Error("That henchman has left the group.");
      updateCache(warbandId, {
        heroes: [result.hero],
        henchmenGroups: result.group ? [result.group] : [],
        removedHenchmenGroupIds: result.group ? [] : [group.id],
        removedHeroIds: atCap && dismissId !== null ? [dismissId] : [],
        summary: result.summary,
      });
      toast.success(
        `${result.hero.name ?? "The new hero"} joins the heroes, with an advance to take.`
      );
      toastServerWarnings(result.warnings);
      onPromoted(result.group === null);
    } catch (error) {
      toast.error("The promotion didn't save.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const label = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
  return (
    <div className="flex flex-col gap-3 border border-accent-line bg-panel p-3">
      <p className="m-0 font-display text-lg font-semibold text-head">The lad&apos;s got talent</p>
      {group.promotable === false ? (
        <p className="m-0 text-xs font-semibold text-danger">
          {group.name} can&apos;t be promoted in their rules.
        </p>
      ) : null}
      <span className={label}>Who joins the heroes</span>
      <div role="group" aria-label="Henchman" className="flex flex-wrap gap-1.5">
        {members.map((member) => (
          <Chip
            key={member.id}
            pressed={memberId === member.id}
            onClick={() => setMemberId(member.id)}
          >
            {member.label}
          </Chip>
        ))}
      </div>
      <TalentSkillLists
        offer={offer.data?.skill_lists ?? []}
        pick={pick}
        chosen={lists}
        onChange={setLists}
      />
      {offer.isError ? (
        <p className="m-0 text-xs font-semibold text-danger">
          The heroes&apos; skill lists didn&apos;t load.
        </p>
      ) : null}
      {atCap ? (
        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
          The warband has {maxHeroes} heroes already. Dismiss one to make room:
          <select
            className="h-9 border border-strong bg-page px-2 text-sm text-ink"
            value={dismissId ?? ""}
            onChange={(event) =>
              setDismissId(event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">Nobody (the promotion is refused at the cap)</option>
            {heroes.map((hero) => (
              <option key={hero.id} value={hero.id}>
                {hero.name} (carried items are lost)
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button disabled={!chosen || !listsReady || saving} onClick={() => void promote()}>
        {!chosen
          ? "Pick who joins the heroes"
          : listsReady
            ? `Promote ${chosen.label}`
            : `Pick ${pick} skill list${pick === 1 ? "" : "s"}`}
      </Button>
    </div>
  );
}
