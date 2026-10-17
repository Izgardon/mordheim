import { unitApi } from "../../units/unit-api";
import {
  buildLevelUpPayload,
  resolveCasterValue,
  resolveHenchmanFromGroup,
  resolveLargeValue,
  splitGroupItems,
} from "../../utils/levelup-utils";

import type { HenchmenGroup } from "../../types/warband-types";

type PromoteHenchmanInput = {
  warbandId: number;
  group: HenchmenGroup;
  groupWithRace: HenchmenGroup;
  selectedHenchmanId: string;
  henchmenOptions: { id: string; label: string }[];
  selectedStat: string;
  roll2d6Total: number | null;
  onLevelUpLogged?: (updatedGroup: HenchmenGroup) => void;
  onGroupRemoved?: (groupId: number) => void;
  /** Tells the cached warband about the change (summary refetch). */
  updateWarbandCache: (warbandId: number) => void;
};

/**
 * Lad's Got Talent, as today's four-step client chain (BUG-28, pinned; one promote endpoint in
 * PR C): POST the hero (two advances, cap ignored, the group's profile, XP, skills, specials and
 * one of each item), POST its level-up, then PATCH the group without him (or DELETE the emptied
 * group), then announce the change. The group's own level-up is never spent, and a failure midway
 * leaves the hero in place.
 */
export async function promoteHenchman({
  warbandId,
  group,
  groupWithRace,
  selectedHenchmanId,
  henchmenOptions,
  selectedStat,
  roll2d6Total,
  onLevelUpLogged,
  onGroupRemoved,
  updateWarbandCache,
}: PromoteHenchmanInput): Promise<"promoted" | "not-found"> {
  const resolved = resolveHenchmanFromGroup(groupWithRace, selectedHenchmanId);
  if (!resolved) {
    return "not-found";
  }
  const { henchman, index, list } = resolved;
  const promotedName =
    henchman.name?.trim() ||
    henchmenOptions.find((option) => option.id === selectedHenchmanId)?.label ||
    `Henchman ${index + 1}`;
  const { removed, remaining } = splitGroupItems(groupWithRace.items ?? []);

  const createdHero = await unitApi("hero").create(warbandId, {
    name: promotedName || null,
    unit_type: groupWithRace.unit_type ?? null,
    race: groupWithRace.race_id ?? null,
    price: 0,
    xp: groupWithRace.xp ?? 0,
    level_up: 2,
    deeds: groupWithRace.deeds ?? null,
    armour_save: groupWithRace.armour_save ?? null,
    large: resolveLargeValue(groupWithRace),
    caster: resolveCasterValue(groupWithRace),
    half_rate: groupWithRace.half_rate ?? null,
    movement: groupWithRace.movement ?? null,
    weapon_skill: groupWithRace.weapon_skill ?? null,
    ballistic_skill: groupWithRace.ballistic_skill ?? null,
    strength: groupWithRace.strength ?? null,
    toughness: groupWithRace.toughness ?? null,
    wounds: groupWithRace.wounds ?? null,
    initiative: groupWithRace.initiative ?? null,
    attacks: groupWithRace.attacks ?? null,
    leadership: groupWithRace.leadership ?? null,
    items: removed.map((item) => ({ id: item.id, cost: item.cost ?? null })),
    skill_ids: groupWithRace.skills?.map((skill) => skill.id) ?? [],
    special_ids: groupWithRace.specials?.map((entry) => entry.id) ?? [],
    spell_ids: [],
    ignore_max_heroes: true,
  });

  await unitApi("hero").levelUp(
    warbandId,
    createdHero.id,
    buildLevelUpPayload({
      unitName: createdHero.name?.trim() || createdHero.unit_type?.trim() || "Unknown Hero",
      selectedStat,
      roll2d6Total,
    })
  );

  const nextHenchmen = list.filter((_, idx) => idx !== index);
  if (nextHenchmen.length === 0) {
    await unitApi("henchmen_group").remove(warbandId, group.id);
    onGroupRemoved?.(group.id);
  } else {
    const updatedGroup = await unitApi("henchmen_group").update(warbandId, group.id, {
      henchmen: nextHenchmen.map((entry) => ({
        id: entry.id,
        name: entry.name,
        kills: entry.kills,
        dead: entry.dead,
        cost: entry.cost,
      })),
      items: remaining.map((item) => ({ id: item.id, cost: item.cost ?? null })),
    });
    if (updatedGroup) {
      onLevelUpLogged?.(updatedGroup);
    }
  }

  updateWarbandCache(warbandId);
  return "promoted";
}
