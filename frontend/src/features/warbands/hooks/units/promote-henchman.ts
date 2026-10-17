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
  selectedHenchmanId,
  henchmenOptions,
  selectedStat,
  roll2d6Total,
  onLevelUpLogged,
  onGroupRemoved,
  updateWarbandCache,
}: PromoteHenchmanInput): Promise<"promoted" | "not-found"> {
  const resolved = resolveHenchmanFromGroup(group, selectedHenchmanId);
  if (!resolved) {
    return "not-found";
  }
  const { henchman, index, list } = resolved;
  const promotedName =
    henchman.name?.trim() ||
    henchmenOptions.find((option) => option.id === selectedHenchmanId)?.label ||
    `Henchman ${index + 1}`;
  const { removed, remaining } = splitGroupItems(group.items ?? []);

  const createdHero = await unitApi("hero").create(warbandId, {
    name: promotedName || null,
    unit_type: group.unit_type ?? null,
    race: group.race_id ?? null,
    price: 0,
    xp: group.xp ?? 0,
    level_up: 2,
    deeds: group.deeds ?? null,
    armour_save: group.armour_save ?? null,
    large: resolveLargeValue(group),
    caster: resolveCasterValue(group),
    half_rate: group.half_rate ?? null,
    movement: group.movement ?? null,
    weapon_skill: group.weapon_skill ?? null,
    ballistic_skill: group.ballistic_skill ?? null,
    strength: group.strength ?? null,
    toughness: group.toughness ?? null,
    wounds: group.wounds ?? null,
    initiative: group.initiative ?? null,
    attacks: group.attacks ?? null,
    leadership: group.leadership ?? null,
    items: removed.map((item) => ({ id: item.id, cost: item.cost ?? null })),
    skill_ids: group.skills?.map((skill) => skill.id) ?? [],
    special_ids: group.specials?.map((entry) => entry.id) ?? [],
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
