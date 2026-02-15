import type { UnitStats } from "./UnitStatsTable";

type HasStats = {
  movement?: number | null;
  weapon_skill?: number | null;
  ballistic_skill?: number | null;
  strength?: number | null;
  toughness?: number | null;
  wounds?: number | null;
  initiative?: number | null;
  attacks?: number | null;
  leadership?: number | null;
  armour_save?: string | null;
  race?: {
    movement: number;
    weapon_skill: number;
    ballistic_skill: number;
    strength: number;
    toughness: number;
    wounds: number;
    initiative: number;
    attacks: number;
    leadership: number;
  } | null;
};

export const toUnitStats = (unit: HasStats): UnitStats => ({
  movement: unit.movement,
  weapon_skill: unit.weapon_skill,
  ballistic_skill: unit.ballistic_skill,
  strength: unit.strength,
  toughness: unit.toughness,
  wounds: unit.wounds,
  initiative: unit.initiative,
  attacks: unit.attacks,
  leadership: unit.leadership,
  armour_save: unit.armour_save,
});

export const toRaceUnitStats = (unit: HasStats): UnitStats | null => {
  if (!unit.race) {
    return null;
  }

  return {
    movement: unit.race.movement,
    weapon_skill: unit.race.weapon_skill,
    ballistic_skill: unit.race.ballistic_skill,
    strength: unit.race.strength,
    toughness: unit.race.toughness,
    wounds: unit.race.wounds,
    initiative: unit.race.initiative,
    attacks: unit.race.attacks,
    leadership: unit.race.leadership,
  };
};
