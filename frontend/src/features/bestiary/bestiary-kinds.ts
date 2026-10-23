/**
 * The bestiary's three kinds of beast (the bestiary rewrite, step 3): a mount, ridden by the unit
 * that carries it; a pet, which goes with its unit (often without a profile); and a creature,
 * which fights as henchmen and is the only kind a battle takes as a temporary ally or enemy.
 */
export type BeastKind = "mount" | "pet" | "creature";

export const BEAST_KINDS: readonly BeastKind[] = ["mount", "pet", "creature"];

const LABELS: Record<BeastKind, string> = {
  mount: "Mount",
  pet: "Pet",
  creature: "Creature",
};

/** "Mount", "Pet", "Creature": what the site calls the kind. */
export const beastKindLabel = (kind: BeastKind) => LABELS[kind];

/** Whether a URL's `kind` names one of the three. */
export const isBeastKind = (value: string): value is BeastKind =>
  (BEAST_KINDS as readonly string[]).includes(value);
