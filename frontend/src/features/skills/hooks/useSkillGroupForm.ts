import { useCallback, useState } from "react";

import { bookCampaign } from "@/features/catalogue/api/catalogue-entry-api";
import { useCatalogueDelete } from "@/features/catalogue/hooks/useCatalogueDelete";
import { useCatalogueRevert } from "@/features/catalogue/hooks/useCatalogueRevert";
import { useNameTakenMatches } from "@/features/catalogue/hooks/useNameTakenMatches";
import {
  draftOf,
  everyone,
  linesPayload,
  type WhoCanDraft,
} from "@/features/catalogue/utils/who-can-draft";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { useFieldErrors } from "@/lib/field-errors";

import { createSkillGroup, updateSkillGroup } from "../api/skills-api";

import type { SkillGroup } from "../types/skill-types";

type SkillGroupFormValues = {
  name: string;
  who: WhoCanDraft;
  large_only: boolean;
  learn_note: string;
  skillIds: number[];
};

const valuesOf = (group: SkillGroup | null): SkillGroupFormValues => ({
  name: group?.name ?? "",
  who: group ? draftOf(group) : everyone(),
  large_only: Boolean(group?.large_only),
  learn_note: group?.learn_note ?? "",
  skillIds: group?.skill_ids ?? [],
});

type UseSkillGroupFormOptions = {
  campaignId: number;
  /** The group being edited; null when adding one. */
  group: SkillGroup | null;
  /** Server field errors clear whenever this changes (the edited group, or the dialog opening). */
  resetKey: unknown;
  onSaved: (group: SkillGroup) => void;
  onDeleted?: (groupId: number) => void;
};

/**
 * A skill group's Add or Edit form (skill groups, phase 1a): its name, who learns from it, whether
 * it is a Large unit's, the note shown when learning from it, and its skills. A book group's
 * first edit makes the campaign's version of it; the answer goes into the cached list, and the
 * skills list is read again.
 */
export function useSkillGroupForm({
  campaignId,
  group,
  resetKey,
  onSaved,
  onDeleted,
}: UseSkillGroupFormOptions) {
  const catalogueCache = useCatalogueCache();
  const [values, setValues] = useState(() => valuesOf(group));
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fieldErrors = useFieldErrors(["name"], resetKey);
  const nameTaken = useNameTakenMatches({ kind: "skill-groups", campaignId, fieldErrors });
  const deletion = useCatalogueDelete({
    kind: "skill-groups",
    campaignId,
    entry: group,
    noun: "skill group",
    onDeleted,
  });
  const revert = useCatalogueRevert({
    kind: "skill-groups",
    campaignId,
    entry: group,
    onReverted: onSaved,
  });

  const save = async (after?: () => void) => {
    if (!values.name.trim()) {
      setFormError("A skill group needs a name.");
      return;
    }
    setIsSaving(true);
    setFormError("");
    const payload = {
      name: values.name.trim(),
      for_everyone: values.who.forEveryone,
      warbands: linesPayload(values.who),
      large_only: values.large_only,
      learn_note: values.learn_note.trim(),
      skill_ids: values.skillIds,
    };
    try {
      const saved = group
        ? await updateSkillGroup(group.id, { ...payload, ...bookCampaign(group, campaignId) })
        : await createSkillGroup({ ...payload, campaign_id: campaignId });
      catalogueCache.write("skill-groups", campaignId, saved, group?.id);
      onSaved(saved);
      after?.();
    } catch (errorResponse) {
      setFormError(fieldErrors.take(errorResponse, "Unable to save skill group"));
    } finally {
      setIsSaving(false);
    }
  };

  const { clear: clearFieldErrors } = fieldErrors;
  const load = useCallback(
    (entry: SkillGroup | null) => {
      setValues(valuesOf(entry));
      setFormError("");
      clearFieldErrors();
    },
    [clearFieldErrors]
  );
  const set = <K extends keyof SkillGroupFormValues>(key: K, value: SkillGroupFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return {
    values,
    set,
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

export type SkillGroupFormState = ReturnType<typeof useSkillGroupForm>;
