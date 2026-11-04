import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  feeDraftOf,
  feeFromDraft,
  type FeeDraft,
} from "@/features/hirelings/components/fees/fee-draft";
import { getErrorMessage } from "@/lib/get-error-message";

import { isWarbandQuery, useWarbandCacheUpdate, type WarbandUpdate } from "../../api/warband-cache";
import { hireWarbandHireling } from "../../api/warbands-hirelings";
import type { TemplateHire } from "../../components/recruit/TemplateRecruit";
import { LIST_KEY } from "../../components/roster/unit-view";
import type { UnitKindKey } from "../../types/units";
import { unitApi } from "../../units/unit-api";
import { toastServerWarnings } from "../../utils/server-warnings";

/** The inline recruit form's fields: the few the roster needs; the rest is set in Edit. */
export type RecruitDraft = {
  name: string;
  type: string;
  race: number | null;
  /** A hero's cost, or a group's cost for each model. */
  cost: string;
  /** A group's models. */
  count: string;
  xp: string;
  /** A hired sword's hire fee paid and the upkeep he is kept for. */
  fee: FeeDraft;
  upkeep: FeeDraft;
};

export const blankRecruit = (): RecruitDraft => ({
  name: "",
  type: "",
  race: null,
  cost: "",
  count: "1",
  xp: "0",
  fee: feeDraftOf(null),
  upkeep: feeDraftOf(null),
});

const whole = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * Recruits a hero or a group (one batch create; from the template, the fighter's key with the
 * kit's purchases) or hires someone not in the list (`hire/` with `source: custom`, then his race
 * and XP), and answers the new card's key so it can open in Edit.
 */
export function useRecruit(kind: UnitKindKey, warbandId: number, existingIds: number[]) {
  const updateCache = useWarbandCacheUpdate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const hire = async (draft: RecruitDraft) => {
    const paid = feeFromDraft(draft.fee);
    const answer = await hireWarbandHireling(warbandId, {
      source: "custom",
      name: draft.name.trim(),
      unit_type: draft.type.trim(),
      price: paid.gold ?? 0,
      // no counter named: the server pays each from the resource of its name
      resources: paid.resources,
      upkeep_fee: feeFromDraft(draft.upkeep),
    });
    toastServerWarnings(answer.warnings);
    const xp = whole(draft.xp);
    const unit =
      draft.race !== null || xp
        ? await unitApi("hireling").update(warbandId, answer.id, { race: draft.race, xp } as never)
        : answer;
    updateCache(warbandId, { hirelings: [unit] });
    return unit.id;
  };

  const create = async (draft: RecruitDraft) => {
    const type = draft.type.trim();
    const models = Math.max(1, Math.min(20, whole(draft.count) || 1));
    const body = {
      name: draft.name.trim() || null,
      unit_type: type || null,
      race: draft.race,
      price: whole(draft.cost),
      xp: whole(draft.xp),
      ...(kind === "henchmen_group"
        ? {
            henchmen: Array.from({ length: models }, (_, i) => ({
              name: `${type || "Henchman"} ${i + 1}`,
            })),
          }
        : {}),
    };
    const result = await unitApi(kind).batch(warbandId, { create: [body as never] });
    updateCache(warbandId, {
      [LIST_KEY[kind]]: result.units,
      summary: result.summary,
    } as WarbandUpdate);
    toastServerWarnings(result.warnings);
    return result.units.find((unit) => !existingIds.includes(unit.id))?.id ?? null;
  };

  /** A hire from the template: the fighter's key, the name, a group's members, his cost and the kit (create 0). */
  const fromTemplate = async (hire: TemplateHire) => {
    const { fighter } = hire;
    const body = {
      fighter_key: fighter.key,
      // a group not named reads as his plural ("Zombies")
      name: hire.name.trim() || (kind === "henchmen_group" ? fighter.plural || null : null),
      price: whole(hire.cost),
      ...(kind === "henchmen_group"
        ? {
            henchmen: Array.from({ length: hire.models }, (_, i) => ({
              name: `${fighter.name} ${i + 1}`,
            })),
          }
        : {}),
    };
    const result = await unitApi(kind).batch(warbandId, {
      create: [body as never],
      ...(hire.purchases.length ? { purchases: hire.purchases } : {}),
      ...(hire.upgrades.length ? { upgrades: hire.upgrades } : {}),
    });
    updateCache(warbandId, {
      [LIST_KEY[kind]]: result.units,
      summary: result.summary,
    } as WarbandUpdate);
    void queryClient.invalidateQueries({ predicate: isWarbandQuery(warbandId, "template") });
    toastServerWarnings(result.warnings);
    return result.units.find((unit) => !existingIds.includes(unit.id))?.id ?? null;
  };

  /** The new unit's card key ("hero-12"), or null when it didn't save. */
  const saved = async (write: () => Promise<number | null>) => {
    setSaving(true);
    try {
      const id = await write();
      return id === null ? null : `${kind}-${id}`;
    } catch (error) {
      toast.error(kind === "hireling" ? "Couldn't hire." : "Couldn't recruit.", {
        description: getErrorMessage(error),
      });
      return null;
    } finally {
      setSaving(false);
    }
  };
  const recruit = (draft: RecruitDraft) =>
    saved(() => (kind === "hireling" ? hire(draft) : create(draft)));
  const recruitFromTemplate = (hire: TemplateHire) => saved(() => fromTemplate(hire));

  return { recruit, recruitFromTemplate, saving };
}
