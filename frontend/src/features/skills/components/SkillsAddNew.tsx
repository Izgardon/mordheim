import { useState } from "react";

import AddNewMenu from "@/features/reference/AddNewMenu";

import type { Skill, SkillGroup } from "../types/skill-types";
import SkillFormDialog from "./SkillFormDialog";
import SkillGroupFormDialog from "./SkillGroupFormDialog";

/** The Skills page's Add new: a skill or a skill group, each its own dialog. */
export default function SkillsAddNew({
  campaignId,
  isMobile,
  onSkill,
  onGroup,
}: {
  campaignId: number;
  isMobile: boolean;
  onSkill: (skill: Skill) => void;
  onGroup: (group: SkillGroup) => void;
}) {
  const [adding, setAdding] = useState<"skill" | "group" | null>(null);
  return (
    <>
      <AddNewMenu
        className={isMobile ? "min-h-10" : undefined}
        entries={[
          { label: "Skill", onSelect: () => setAdding("skill") },
          { label: "Skill group", onSelect: () => setAdding("group") },
        ]}
      />
      <SkillFormDialog
        mode="create"
        campaignId={campaignId}
        open={adding === "skill"}
        onOpenChange={(open) => setAdding(open ? "skill" : null)}
        onCreated={onSkill}
        trigger={null}
      />
      <SkillGroupFormDialog
        campaignId={campaignId}
        group={null}
        open={adding === "group"}
        onOpenChange={(open) => setAdding(open ? "group" : null)}
        onSaved={onGroup}
        trigger={null}
      />
    </>
  );
}
