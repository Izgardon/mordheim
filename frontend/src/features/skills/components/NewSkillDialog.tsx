import { useEffect, useMemo, useState } from "react";

// components
import { Button } from "@components/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@components/dialog";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";

// stores
import { useAppStore } from "@/stores/app-store";

// api
import { listSkills } from "../api/skills-api";
import { updateWarbandHero, getWarbandHeroDetail } from "@/features/warbands/api/warbands-api";

// utils
import { skillAbbrevToType } from "@/features/warbands/utils/warband-utils";

// types
import type { WarbandHero } from "@/features/warbands/types/warband-types";
import type { Skill } from "../types/skill-types";

type NewSkillDialogProps = {
  hero: WarbandHero;
  warbandId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHeroUpdated?: (hero: WarbandHero) => void;
};

export default function NewSkillDialog({
  hero,
  warbandId,
  open,
  onOpenChange,
  onHeroUpdated,
}: NewSkillDialogProps) {
  const { warband } = useAppStore();
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedType, setSelectedType] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const campaignId = warband?.campaign_id;

  // fetch all skills on open
  useEffect(() => {
    if (!open || !campaignId) return;
    listSkills({ campaignId }).then(setAllSkills).catch(() => {});
  }, [open, campaignId]);

  // hero's enabled skill types from available_skills
  const enabledTypes = useMemo(() => {
    const raw = hero.available_skills;
    if (!raw) return new Set<string>();
    // new format: string[]
    if (Array.isArray(raw)) return new Set<string>(raw as string[]);
    // legacy format: { C: true, Spc: true, "Necromancy": true, ... }
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
  }, [hero.available_skills]);

  // all unique skill types from the API, filtered to only those the hero has enabled
  const allowedTypes = useMemo(
    () => [...new Set(allSkills.map((s) => s.type).filter((t): t is string => !!t && t !== "Pending" && enabledTypes.has(t)))],
    [allSkills, enabledTypes]
  );

  // of those, which does the hero already have skills in
  const knownTypes = useMemo(
    () => [
      ...new Set(
        (hero.skills ?? [])
          .map((s) => s.type)
          .filter((t): t is string => !!t && t !== "Pending" && enabledTypes.has(t))
      ),
    ],
    [hero.skills, enabledTypes]
  );

  const knownTypeSet = useMemo(() => new Set(knownTypes), [knownTypes]);
  const otherTypes = useMemo(() => allowedTypes.filter((t) => !knownTypeSet.has(t)), [allowedTypes, knownTypeSet]);

  // default to first allowed type when dialog opens
  useEffect(() => {
    if (open && allowedTypes.length > 0 && !selectedType) {
      setSelectedType(knownTypes[0] ?? allowedTypes[0]);
    }
  }, [open, allowedTypes, knownTypes, selectedType]);

  // hero's learned skills for the selected type
  const heroSkillsForType = useMemo(
    () => (hero.skills ?? []).filter((s) => s.type === selectedType && s.type !== "Pending"),
    [hero.skills, selectedType]
  );

  // skills filtered to selected type
  const typeSkills = useMemo(
    () => allSkills.filter((s) => s.type === selectedType).sort((a, b) => a.name.localeCompare(b.name)),
    [allSkills, selectedType]
  );

  const selectedSkill = useMemo(
    () => typeSkills.find((s) => String(s.id) === selectedSkillId) ?? null,
    [typeSkills, selectedSkillId]
  );

  // check if hero already knows the selected skill
  const alreadyKnown = useMemo(() => {
    if (!selectedSkill) return false;
    return (hero.skills ?? []).some(
      (s) => s.id === selectedSkill.id && s.type !== "Pending"
    );
  }, [hero.skills, selectedSkill]);

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
      const existingSkillIds = (hero.skills ?? [])
        .filter((s) => s.type !== "Pending")
        .map((s) => s.id);
      const pendingSkills = (hero.skills ?? []).filter((s) => s.type === "Pending");
      const pendingIds = pendingSkills.slice(1).map((s) => s.id);

      await updateWarbandHero(warbandId, hero.id, {
        skill_ids: [...existingSkillIds, ...pendingIds, selectedSkill.id],
      } as any);

      const freshHero = await getWarbandHeroDetail(warbandId, hero.id);
      onHeroUpdated?.(freshHero);
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

        {/* Skill Type Dropdown */}
        <div className="space-y-2">
          <Label>Skill Type</Label>
          <Select value={selectedType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select skill type" />
            </SelectTrigger>
            <SelectContent>
              {allowedTypes.map((type) => (
                <SelectItem key={type} value={type} className={knownTypeSet.has(type) ? "text-[#f5d97b]" : ""}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedType && heroSkillsForType.length > 0 && (
            <div className="max-h-[100px] overflow-y-auto rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
              {heroSkillsForType.map((skill, i) => (
                <div key={`${skill.id}-${i}`} className="py-0.5 text-muted-foreground">
                  {skill.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skill Dropdown */}
        <div className="space-y-2">
          <Label>Skill</Label>
          <Select
            value={selectedSkillId}
            onValueChange={setSelectedSkillId}
            disabled={!selectedType || typeSkills.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={typeSkills.length === 0 ? "No skills" : "Select skill"} />
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

        {/* Skill Details */}
        <div className="h-[120px] overflow-y-auto rounded border border-white/10 bg-white/5 px-3 py-2 text-sm">
          {selectedSkill ? (
            <div className="space-y-1">
              <p className="font-semibold text-foreground">{selectedSkill.name}</p>
              {selectedSkill.description && (
                <p className="text-muted-foreground">{selectedSkill.description}</p>
              )}
              {alreadyKnown && (
                <p className="mt-1 text-xs text-[#f5d97b]">This hero already knows this skill.</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground/50">Select a skill to see its details.</p>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Learn Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleLearn}
            disabled={isSubmitting || !selectedSkill}
          >
            {isSubmitting ? "Learning..." : "Learn Skill"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
