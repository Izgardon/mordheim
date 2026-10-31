import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import { useWarbandCacheUpdate, type WarbandUpdate } from "../../../api/warband-cache";
import { unitApi, type UnitBatch } from "../../../units/unit-api";
import type { UnitKindKey } from "../../../types/units";
import type { ShareChoice } from "../../../hooks/units/useGroupLoadout";
import type { Henchman } from "../../../types/warband-types";
import { buildAvailableSkillsPayload, parseAvailableSkills } from "../../../utils/warband-utils";
import { LIST_KEY, isGroup, type RosterUnit } from "../unit-view";

export const STAT_FIELDS = {
  M: "movement",
  WS: "weapon_skill",
  BS: "ballistic_skill",
  S: "strength",
  T: "toughness",
  W: "wounds",
  I: "initiative",
  A: "attacks",
  Ld: "leadership",
  Sv: "armour_save",
} as const;

const REMOVED_KEY = {
  hero: "removedHeroIds",
  henchmen_group: "removedHenchmenGroupIds",
  hireling: "removedHirelingIds",
} as const;

/** A recruit's loadout row: bought with him (in his cost), taken from the stash, or he joins without it. */
export type KitChoice = "buy" | "stash" | "without";
/** A model in the edit form: a new one carries his kit choices, by loadout row id. */
export type MemberDraft = Partial<Henchman> & { kit?: Record<number, KitChoice> };

const kitLists = (kit: Record<number, KitChoice> = {}) => {
  const rows = (choice: KitChoice) =>
    Object.entries(kit).flatMap(([row, picked]) => (picked === choice ? [Number(row)] : []));
  return { from_stash: rows("stash"), without: rows("without") };
};

export type Named = { id: number; name: string; type?: string | null };
export type EditLists = { skills: Named[]; specials: Named[]; spells: Named[] };
type Draft = Record<string, unknown>;

const numberOrNull = (value: unknown) => (value === "" || value === null ? null : Number(value));

function initialDraft(entry: RosterUnit): Draft {
  const { unit } = entry;
  return {
    name: unit.name ?? "",
    unit_type: unit.unit_type ?? "",
    race: unit.race_id ?? null,
    price: unit.price ?? 0,
    xp: unit.xp ?? 0,
    half_rate: Boolean(unit.half_rate),
    missing_games: unit.missing_games ?? 0,
    missing_reason: unit.missing_reason ?? "",
    large: Boolean(unit.large),
    ...Object.fromEntries(Object.values(STAT_FIELDS).map((field) => [field, unit[field] ?? ""])),
    ...("is_leader" in unit
      ? { is_leader: Boolean(unit.is_leader), trading_action: Boolean(unit.trading_action) }
      : {}),
    ...("caster" in unit ? { caster: unit.caster ?? "No" } : {}),
    ...("pending_skills" in unit
      ? {
          pending_skills: unit.pending_skills ?? 0,
          pending_spells: unit.pending_spells ?? 0,
          pending_specials: unit.pending_specials ?? 0,
        }
      : {}),
    ...("available_skills" in unit
      ? { available_skills: parseAvailableSkills(unit.available_skills) }
      : {}),
    ...(entry.kind === "hireling"
      ? {
          no_level_ups: Boolean(entry.unit.no_level_ups),
          blood_pacted: Boolean(entry.unit.blood_pacted),
        }
      : {}),
  };
}

/** One unit's edit form state, the payload it saves and the batch save itself (one unit). */
export function useUnitEditDraft(entry: RosterUnit, campaignId: number, warbandId: number) {
  const { kind, unit } = entry;
  const queryClient = useQueryClient();
  const updateCache = useWarbandCacheUpdate();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(entry));
  const [lists, setLists] = useState<EditLists>({
    skills: (unit.skills ?? []) as Named[],
    specials: (unit.specials ?? []) as Named[],
    spells: ("spells" in unit ? (unit.spells ?? []) : []) as Named[],
  });
  const [members, setMembers] = useState<MemberDraft[]>(isGroup(entry) ? entry.unit.henchmen : []);
  // members the form removed, and where each one's share of the loadout goes (henchmen loadouts)
  const [dismissed, setDismissed] = useState<Record<number, ShareChoice>>({});
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const payload = () => {
    const { available_skills: access, ...rest } = draft;
    return {
      ...rest,
      price: Number(draft.price) || 0,
      xp: Number(draft.xp) || 0,
      missing_games: Number(draft.missing_games) || 0,
      ...Object.fromEntries(
        Object.values(STAT_FIELDS).map((field) => [field, numberOrNull(draft[field])])
      ),
      ...(access
        ? { available_skills: buildAvailableSkillsPayload(access as Record<string, boolean>) }
        : {}),
      skill_ids: lists.skills.map((skill) => skill.id),
      special_ids: lists.specials.map((special) => special.id),
      ...(kind === "henchmen_group" ? {} : { spell_ids: lists.spells.map((spell) => spell.id) }),
      ...(isGroup(entry)
        ? {
            henchmen: [
              ...members.map(({ id, name, kills, dead, kit }) => ({
                id,
                name: name ?? "",
                kills,
                dead,
                ...(id === undefined ? kitLists(kit) : {}),
              })),
              ...Object.entries(dismissed).map(([id, share]) => ({
                id: Number(id),
                dismiss: share,
              })),
            ],
          }
        : {}),
    };
  };

  /** Saves `body` through the kind's batch endpoint; true when it saved. */
  const run = async (body: UnitBatch<UnitKindKey>) => {
    setSaving(true);
    try {
      const result = await unitApi(kind).batch(warbandId, body as never);
      updateCache(warbandId, {
        [LIST_KEY[kind]]: result.units,
        summary: result.summary,
        ...(body.dismiss ? { [REMOVED_KEY[kind]]: body.dismiss } : {}),
      } as WarbandUpdate);
      void queryClient.invalidateQueries({
        queryKey: ["campaign", campaignId, "warband", warbandId],
      });
      return true;
    } catch (error) {
      toast.error("That didn't save.", { description: getErrorMessage(error) });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = () => run({ update: [{ id: unit.id, updated_at: unit.updated_at, ...payload() }] });
  const duplicate = () =>
    run({
      create: [
        {
          ...payload(),
          ...(isGroup(entry)
            ? { henchmen: members.map(({ name }) => ({ name: name ?? "" })) }
            : {}),
          name: `${draft.name || draft.unit_type} (copy)`,
        },
      ],
    });
  const dismiss = () => run({ dismiss: [unit.id] });

  return {
    draft,
    set,
    lists,
    setLists,
    members,
    setMembers,
    dismissed,
    setDismissed,
    saving,
    save,
    duplicate,
    dismiss,
  };
}

export type UnitEditDraft = ReturnType<typeof useUnitEditDraft>;
