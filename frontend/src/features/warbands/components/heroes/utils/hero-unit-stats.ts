import type { UnitStats } from "@/components/units/UnitStatsTable";
import type { WarbandHero } from "../../../types/warband-types";

export const heroToUnitStats = (hero: WarbandHero): UnitStats => ({
  movement: hero.movement,
  weapon_skill: hero.weapon_skill,
  ballistic_skill: hero.ballistic_skill,
  strength: hero.strength,
  toughness: hero.toughness,
  wounds: hero.wounds,
  initiative: hero.initiative,
  attacks: hero.attacks,
  leadership: hero.leadership,
  armour_save: hero.armour_save,
});

export const heroRaceToUnitStats = (hero: WarbandHero): UnitStats | null => {
  if (!hero.race) {
    return null;
  }

  return {
    movement: hero.race.movement,
    weapon_skill: hero.race.weapon_skill,
    ballistic_skill: hero.race.ballistic_skill,
    strength: hero.race.strength,
    toughness: hero.race.toughness,
    wounds: hero.race.wounds,
    initiative: hero.race.initiative,
    attacks: hero.race.attacks,
    leadership: hero.race.leadership,
  };
};

