import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { promoteHenchman } from "../../hooks/units/promote-henchman";
import type { HenchmenGroup, WarbandHero } from "../../types/warband-types";
import { buildHenchmenOptions } from "../../utils/levelup-utils";
import { unitName } from "./unit-view";

/**
 * The lad's got talent (a henchmen roll of 10–12; William: "after rolling you should see the
 * henchmen names and then click a henchman then lock in promote"): the member who joins the
 * heroes and, at the hero cap, a hero to dismiss to make room. Promote makes him a hero with an
 * advance to take later on his card ("we dont then level up that new hero then and there"); the
 * group keeps its level-up, so the dialog then offers its roll again (`onPromoted`).
 */
export default function LadsGotTalent({
  group,
  warbandId,
  heroes,
  maxHeroes,
  onPromoted,
}: {
  group: HenchmenGroup;
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
  const [saving, setSaving] = useState(false);
  const atCap = maxHeroes !== null && heroes.length >= maxHeroes;
  const chosen = members.find((member) => member.id === memberId);

  const promote = async () => {
    if (!memberId) return;
    setSaving(true);
    try {
      const result = await promoteHenchman({
        warbandId,
        group,
        selectedHenchmanId: memberId,
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
      toast.success(`${result.hero.name ?? "He"} joins the heroes, with an advance to take.`);
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
                {unitName(hero)} (carried items are lost)
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button disabled={!chosen || saving} onClick={() => void promote()}>
        {chosen ? `Promote ${chosen.label}` : "Pick who joins the heroes"}
      </Button>
    </div>
  );
}
