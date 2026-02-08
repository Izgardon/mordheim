const PENDING_NAMES: Record<string, string> = {
  skill: "New Skill",
  spell: "New Spell",
  feature: "New Feature",
};

const PENDING_TYPE = "Pending";

/** Check by name only (summary cards where type field isn't available). */
export function isPendingByName(type: "skill" | "spell" | "feature", name: string): boolean {
  return name === PENDING_NAMES[type];
}

/** Check by type field (edit form where the full object is available). */
export function isPendingByType(entry: { type?: string | null }): boolean {
  return entry.type === PENDING_TYPE;
}
