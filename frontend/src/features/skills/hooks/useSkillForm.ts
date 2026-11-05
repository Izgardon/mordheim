import { useCallback, useState } from "react";
import { useDirtySince } from "@/components/ui/discard-changes";

import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors, type NameMatch } from "@/lib/field-errors";

import { createSkill, updateSkill } from "../api/skills-api";

import type { Skill } from "../types/skill-types";

type SkillFormValues = {
  name: string;
  description: string;
  /** The skill groups holding it (skill groups, phase 1a); null until changed: the groups list's. */
  groupIds: number[] | null;
};

const valuesOf = (skill: Skill | null): SkillFormValues => ({
  name: skill?.name ?? "",
  description: skill?.description ?? "",
  groupIds: null,
});

type UseSkillFormOptions = {
  campaignId: number;
  /** The skill being edited; null when adding one. */
  skill: Skill | null;
  /** The ids of the campaign's groups holding a skill (`groupsOf`). */
  groupIdsOf: (skillId: number) => number[];
  /** Server field errors clear whenever this changes (the edited skill, or the dialog opening). */
  resetKey: unknown;
  /** After a save, its answer already in the cached skills list. */
  onSaved: (skill: Skill) => void;
  /** After a delete, the skill already gone from the cached list. */
  onDeleted?: (skillId: number) => void;
  /** Opens the edit form on an entry a taken name collided with ("Edit this instead"). */
  onEditMatch?: (match: NameMatch) => void;
  /** After a Revert, the book's skill already in the version's place in the cached list. */
  onReverted?: (skill: Skill) => void;
};

/**
 * A skill's Add or Edit form, inline on the Skills page or in the warband pages' dialog: the
 * values, the groups that hold it, the save (trimmed values; the answer goes into the cached list,
 * and the groups list is read again) and the delete (refusals stay in its confirm, BUG-148).
 */
export function useSkillForm({
  campaignId,
  skill,
  groupIdsOf,
  resetKey,
  onSaved,
  onDeleted,
  onReverted,
  onEditMatch,
}: UseSkillFormOptions) {
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(() => valuesOf(skill));
  const { dirty, markClean } = useDirtySince(values);
  const groupIds = values.groupIds ?? (skill ? groupIdsOf(skill.id) : []);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({
    kind: "skills",
    campaignId,
    fieldErrors,
    onEditMatch,
  });
  const deletion = useCatalogueDelete({
    kind: "skills",
    campaignId,
    entry: skill,
    noun: "skill",
    onDeleted,
  });
  const revert = useCatalogueRevert({ kind: "skills", campaignId, entry: skill, onReverted });

  const save = async (after?: () => void) => {
    if (!values.name.trim() || !values.description.trim()) {
      setFormError("Name and description are required.");
      return;
    }
    if (!skill && Number.isNaN(campaignId)) {
      setFormError("Unable to create skill.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      group_ids: groupIds,
    };
    try {
      // A book skill's first edit makes the campaign's version of it (CAT-TWEAK-01).
      const saved = skill
        ? await updateSkill(skill.id, { ...payload, ...bookCampaign(skill, campaignId) })
        : await createSkill({ ...payload, campaign_id: campaignId });
      catalogueCache.write("skills", campaignId, saved, skill?.id);
      if (skill) {
        // The copies now point at the version, or show the edited entry: sheets read them again.
        void catalogueCache.heldCopiesChanged("skills", campaignId);
      }
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, "Unable to save skill"));
    } finally {
      setIsSaving(false);
    }
  };

  const { clear: clearFieldErrors } = fieldErrors;
  /** Back to `entry`'s values (a blank form for null), with no message. */
  const load = useCallback(
    (entry: Skill | null) => {
      setValues(valuesOf(entry));
      markClean();
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors, markClean]
  );

  return {
    dirty,
    values: { ...values, groupIds },
    setName: (name: string) => setValues((prev) => ({ ...prev, name })),
    setDescription: (description: string) => setValues((prev) => ({ ...prev, description })),
    setGroupIds: (groupIds: number[]) => setValues((prev) => ({ ...prev, groupIds })),
    fieldErrors: fieldErrors.errors,
    nameTaken,
    isSaving: isSaving || deletion.isDeleting,
    formError,
    deleteConfirm: deletion.deleteConfirm,
    revert,
    save,
    remove: deletion.remove,
    load,
  };
}

export type SkillFormState = ReturnType<typeof useSkillForm>;
