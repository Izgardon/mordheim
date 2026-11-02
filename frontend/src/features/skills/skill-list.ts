import type { SkillList } from "@/components/ui/game-icons";

const CORE: Record<string, SkillList> = {
  combat: "combat",
  shooting: "shooting",
  academic: "academic",
  strength: "strength",
  speed: "speed",
};

/** Which list a skill's type is, for its icon: one of the five core lists, else a special list. */
export const skillList = (type?: string | null): SkillList =>
  CORE[(type ?? "").trim().toLowerCase()] ?? "special";
