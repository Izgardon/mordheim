import { Tooltip } from "@/components/ui/tooltip";
import { BEAST_KIND_TEXT, BeastKindIcon } from "@/features/bestiary/components/BeastKindIcon";
import CompanionAbilityLines from "@/features/warbands/components/units/beasts/CompanionAbilityLines";
import CreatureMark from "@/features/warbands/components/units/beasts/CreatureMark";

import type {
  BattleRosterCompanion,
  BattleRosterMount,
  BattleUnitStats,
} from "@/features/battles/types/battle-types";

const LINE: [keyof BattleUnitStats, string][] = [
  ["movement", "M"],
  ["weapon_skill", "WS"],
  ["ballistic_skill", "BS"],
  ["strength", "S"],
  ["toughness", "T"],
  ["wounds", "W"],
  ["initiative", "I"],
  ["attacks", "A"],
  ["leadership", "Ld"],
];

const profileLine = (beast: BattleRosterCompanion) =>
  beast.hasProfile && beast.stats
    ? LINE.map(([key, label]) => `${label} ${beast.stats![key] ?? "-"}`).join(" · ")
    : "No profile";

/** A mount's or pet's tooltip: what it is, its profile line and its skills, specials and spells. */
function BeastDetails({ title, beast }: { title?: string; beast: BattleRosterCompanion }) {
  return (
    <span className="block space-y-1">
      {title ? <span className="block font-semibold">{title}</span> : null}
      <span className="block">{profileLine(beast)}</span>
      <CompanionAbilityLines
        skills={beast.skills}
        specials={beast.specials}
        spells={beast.spells}
        className="space-y-0.5"
      />
    </span>
  );
}

/**
 * The mount's mark before a rider's name ("Rides Warhorse"), opening the mount's profile and
 * entries; nothing on foot.
 */
export function RiderMark({ mount }: { mount?: BattleRosterMount | null }) {
  if (!mount) return null;
  const title = `Rides ${mount.name}`;
  return (
    <Tooltip
      trigger={<CreatureMark kind="mount" title={title} />}
      content={<BeastDetails title={title} beast={mount} />}
      maxWidth={320}
      className="inline-flex"
    />
  );
}

/** A unit's pets as chips, each with its profile (or "No profile") and entries in a tooltip. */
export function PetChips({ pets }: { pets?: BattleRosterCompanion[] }) {
  if (!pets?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {pets.map((pet, index) => (
        <Tooltip
          // Two copies of one pet share an item id: the roster names no row.
          key={`${pet.itemId}-${index}`}
          trigger={
            <span
              className={`battle-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] ${BEAST_KIND_TEXT.pet}`}
            >
              <BeastKindIcon kind="pet" className="h-3 w-3" />
              {pet.name}
            </span>
          }
          content={<BeastDetails beast={pet} />}
          maxWidth={320}
          className="inline-flex"
        />
      ))}
    </span>
  );
}
