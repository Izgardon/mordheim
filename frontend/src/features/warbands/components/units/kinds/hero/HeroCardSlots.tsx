import NewSkillDialog from "@/features/skills/components/NewSkillDialog";
import NewSpellDialog from "@/features/spells/components/NewSpellDialog";
import LeaderCrown from "./LeaderCrown";

import type { WarbandHero } from "../../../../types/warband-types";
import type { PendingAdvanceDialogsProps } from "../../../../units/unit-slot-types";

export function HeroExpandedTitle({ unit: hero }: { unit: WarbandHero }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-2xl font-bold text-foreground">{hero.name || "Unnamed Hero"}</h2>
      {hero.is_leader && <LeaderCrown />}
    </div>
  );
}

export function HeroPendingDialogs({
  unit: hero,
  warbandId,
  spellOpen,
  onSpellOpenChange,
  skillOpen,
  onSkillOpenChange,
  onUnitUpdated,
}: PendingAdvanceDialogsProps<"hero">) {
  return (
    <>
      <NewSpellDialog
        hero={hero}
        warbandId={warbandId}
        open={spellOpen}
        onOpenChange={onSpellOpenChange}
        onHeroUpdated={onUnitUpdated}
      />
      <NewSkillDialog
        hero={hero}
        warbandId={warbandId}
        open={skillOpen}
        onOpenChange={onSkillOpenChange}
        onHeroUpdated={onUnitUpdated}
      />
    </>
  );
}
