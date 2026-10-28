import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { Dialog, DialogContent, DialogTitle } from "@components/dialog";
import { Label } from "@components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import { useAppStore } from "@/stores/app-store";

import { useCatalogue } from "@/lib/catalogue-queries";
import { updateWarbandHireling } from "@/features/warbands/api/warbands-api";

import { skillAbbrevToType } from "@/features/warbands/utils/warband-utils";

import type { WarbandHireling } from "@/features/warbands/types/warband-types";

type NewHirelingSkillDialogProps = {
  hireling: WarbandHireling;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHirelingUpdated?: (updated: WarbandHireling) => void;
};

export default function NewHirelingSkillDialog({
  hireling,
  warbandId,
  open,
  onOpenChange,
  onHirelingUpdated,
}: NewHirelingSkillDialogProps) {
  const { warband } = useAppStore();
  const [selectedType, setSelectedType] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const campaignId = warband?.campaign_id;

  // The campaign's skills list, shared with the rest of the app and fetched on first open.
  const { data: allSkills } = useCatalogue("skills", campaignId, { enabled: open });

  const enabledTypes = useMemo(() => {
    const raw = hireling.available_skills;
    if (!raw) return new Set<string>();
    if (Array.isArray(raw)) return new Set<string>(raw as string[]);
    if (typeof raw === "object") {
      const types = new Set<string>();
      for (const [key, enabled] of Object.entries(raw)) {
        if (!enabled || key === "Spc") continue;
        const fullName = skillAbbrevToType[key];
        types.add(fullName ?? key);
      }
      return types;
    }
    return new Set<string>();
  }, [hireling.available_skills]);

  const allowedTypes = useMemo(
    () => [
      ...new Set(
        allSkills
          .map((s) => s.type)
          .filter((t): t is string => !!t && t !== "Pending" && enabledTypes.has(t))
      ),
    ],
    [allSkills, enabledTypes]
  );

  const knownTypes = useMemo(
    () => [
      ...new Set(
        (hireling.skills ?? [])
          .map((s) => s.type)
          .filter((t): t is string => !!t && t !== "Pending" && enabledTypes.has(t))
      ),
    ],
    [hireling.skills, enabledTypes]
  );

  const knownTypeSet = useMemo(() => new Set(knownTypes), [knownTypes]);
  const hasAllowedTypes = allowedTypes.length > 0;

  useEffect(() => {
    if (open && allowedTypes.length > 0 && !selectedType) {
      setSelectedType(knownTypes[0] ?? allowedTypes[0]);
    }
  }, [open, allowedTypes, knownTypes, selectedType]);

  const unitSkillsForType = useMemo(
    () => (hireling.skills ?? []).filter((s) => s.type === selectedType && s.type !== "Pending"),
    [hireling.skills, selectedType]
  );

  const typeSkills = useMemo(
    () =>
      allSkills.filter((s) => s.type === selectedType).sort((a, b) => a.name.localeCompare(b.name)),
    [allSkills, selectedType]
  );

  const selectedSkill = useMemo(
    () => typeSkills.find((s) => String(s.id) === selectedSkillId) ?? null,
    [typeSkills, selectedSkillId]
  );

  const alreadyKnown = useMemo(() => {
    if (!selectedSkill) return false;
    return (hireling.skills ?? []).some((s) => s.id === selectedSkill.id && s.type !== "Pending");
  }, [hireling.skills, selectedSkill]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSelectedType("");
      setSelectedSkillId("");
      setError("");
    }
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setSelectedSkillId("");
  };

  const handleLearn = async () => {
    if (!selectedSkill) return;

    setIsSubmitting(true);
    setError("");

    try {
      const existingSkillIds = (hireling.skills ?? [])
        .filter((s) => s.type !== "Pending")
        .map((s) => s.id);
      const pendingSkills = (hireling.skills ?? []).filter((s) => s.type === "Pending");
      const pendingIds = pendingSkills.slice(1).map((s) => s.id);

      // The PATCH answers with the hired sword as saved: no GET after it.
      const updated = await updateWarbandHireling(warbandId, hireling.id, {
        skill_ids: [...existingSkillIds, ...pendingIds, selectedSkill.id],
      });
      onHirelingUpdated?.(updated);
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to learn skill");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogTitle className="text-center">Learn New Skill</DialogTitle>

        <div className="space-y-2">
          <Label>Skill Type</Label>
          <Select value={selectedType} onValueChange={handleTypeChange} disabled={!hasAllowedTypes}>
            <SelectTrigger>
              <SelectValue
                placeholder={hasAllowedTypes ? "Select skill type" : "No skill types available"}
              />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  className={knownTypeSet.has(type) ? "text-[#f5d97b]" : ""}
                >
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!hasAllowedTypes ? (
            <p className="text-xs text-muted-foreground">Add a skill type for this unit.</p>
          ) : null}
          {selectedType && unitSkillsForType.length > 0 && (
            <div className="max-h-[100px] overflow-y-auto rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
              {unitSkillsForType.map((skill, i) => (
                <div key={`${skill.id}-${i}`} className="py-0.5 text-muted-foreground">
                  {skill.name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Skill</Label>
          <Select
            value={selectedSkillId}
            onValueChange={setSelectedSkillId}
            disabled={!hasAllowedTypes || !selectedType || typeSkills.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !hasAllowedTypes
                    ? "Add a skill type first"
                    : typeSkills.length === 0
                      ? "No skills"
                      : "Select skill"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {typeSkills.map((skill) => (
                <SelectItem key={skill.id} value={String(skill.id)}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="h-[120px] overflow-y-auto rounded border border-white/10 bg-white/5 px-3 py-2 text-sm">
          {selectedSkill ? (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{selectedSkill.name}</p>
              {selectedSkill.description && (
                <p className="text-muted-foreground">{selectedSkill.description}</p>
              )}
              {alreadyKnown && (
                <p className="mt-1 text-xs text-[#f5d97b]">
                  This hired sword already knows this skill.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground/50">Select a skill to see its details.</p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleLearn} disabled={isSubmitting || !selectedSkill}>
            {isSubmitting ? "Learning..." : "Learn Skill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
