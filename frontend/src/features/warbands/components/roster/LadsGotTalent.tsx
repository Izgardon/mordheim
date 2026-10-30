import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { rollDie } from "@/lib/dice";
import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { promoteHenchman } from "../../hooks/units/promote-henchman";
import type { HenchmenGroup, WarbandHero } from "../../types/warband-types";
import {
  HERO_SELECTABLE_STATS,
  OTHER_OPTIONS,
  buildHenchmenOptions,
  needsHero1d6Followup,
  resolveAdvanceLabel,
  resolveHero1d6Stat,
  resolveHero2d6Stat,
} from "../../utils/levelup-utils";
import { unitName } from "./unit-view";

const HERO_OPTIONS = [...HERO_SELECTABLE_STATS, ...OTHER_OPTIONS.map((option) => option.id)];

/**
 * The lad's got talent (a henchmen roll of 10–12): pick the member who joins the heroes, roll
 * (or pick) his hero advance, and at the hero cap name a hero to dismiss to make room. One
 * request promotes him, spends the group's level-up and takes him out of the group.
 */
export default function LadsGotTalent({
  group,
  warbandId,
  heroes,
  maxHeroes,
  onDone,
}: {
  group: HenchmenGroup;
  warbandId: number;
  heroes: WarbandHero[];
  maxHeroes: number | null;
  onDone: () => void;
}) {
  const updateCache = useWarbandCacheUpdate();
  const members = buildHenchmenOptions({
    ...group,
    henchmen: group.henchmen.filter((member) => !member.dead),
  });
  const [memberId, setMemberId] = useState<string | null>(members[0]?.id ?? null);
  const [roll2, setRoll2] = useState<number | null>(null);
  const [roll1, setRoll1] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const atCap = maxHeroes !== null && heroes.length >= maxHeroes;

  const roll = () => {
    const total = rollDie(6) + rollDie(6);
    setRoll2(total);
    setRoll1(null);
    setPicked(resolveHero2d6Stat(total));
  };
  const followUp = () => {
    if (roll2 === null) return;
    const total = rollDie(6);
    setRoll1(total);
    setPicked(resolveHero1d6Stat(roll2, total));
  };

  const promote = async () => {
    if (!memberId || !picked) return;
    setSaving(true);
    try {
      const result = await promoteHenchman({
        warbandId,
        group,
        selectedHenchmanId: memberId,
        selectedStat: picked,
        roll2d6Total: roll2,
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
      toast.success(`${result.hero.name ?? "He"} joins the heroes.`);
      onDone();
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
      <span className={label}>His hero advance</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={roll}>
          Roll 2D6
        </Button>
        {roll2 !== null ? (
          <span className="font-mono text-lg font-bold text-head">{roll2}</span>
        ) : null}
        {roll2 !== null && needsHero1d6Followup(roll2) ? (
          <>
            <Button size="sm" variant="secondary" onClick={followUp}>
              Roll D6
            </Button>
            {roll1 !== null ? (
              <span className="font-mono text-lg font-bold text-head">{roll1}</span>
            ) : null}
          </>
        ) : null}
      </div>
      <div role="group" aria-label="Hero advance" className="flex flex-wrap gap-1.5">
        {HERO_OPTIONS.map((option) => (
          <Chip key={option} pressed={picked === option} onClick={() => setPicked(option)}>
            {resolveAdvanceLabel(option)}
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
      <Button disabled={!memberId || !picked || saving} onClick={() => void promote()}>
        {picked ? `Promote with ${resolveAdvanceLabel(picked)}` : "Pick his advance"}
      </Button>
    </div>
  );
}
