import type {
  HirelingInjuryTable,
  HirelingKind,
  HirelingStays,
  HirelingTerms,
} from "../../types/warband-types";

type WithTerms = {
  kind?: HirelingKind | null;
  injury_table?: HirelingInjuryTable | null;
  stays?: HirelingStays | null;
  payment_note?: string | null;
};

/** A hand-typed hireling's starting terms: a hired sword, on the henchman table, who stays. */
export const HIRED_SWORD_TERMS: HirelingTerms = {
  kind: "hired_sword",
  injury_table: "henchman",
  stays: "always",
  payment_note: "",
};

/** A dramatis persona's, as the hire gives him: the hero table (house rules may change it). */
export const DRAMATIS_PERSONA_TERMS: HirelingTerms = {
  ...HIRED_SWORD_TERMS,
  kind: "dramatis_persona",
  injury_table: "hero",
};

/** A hireling's terms, an older payload's missing ones filled in. */
export const hirelingTermsOf = (unit: WithTerms): HirelingTerms => ({
  kind: unit.kind ?? "hired_sword",
  injury_table: unit.injury_table ?? "henchman",
  stays: unit.stays ?? "always",
  payment_note: unit.payment_note ?? "",
});

export const isDramatisPersona = (unit: WithTerms) => unit.kind === "dramatis_persona";

/** What the site calls it: "Hired sword" or "Dramatis persona", never "hireling". */
export const hirelingKindLabel = (unit: WithTerms) =>
  isDramatisPersona(unit) ? "Dramatis persona" : "Hired sword";

/**
 * Whether a hireling takes one of the warband's hired-sword places (`max_hired_swords`): a hired
 * sword without a blood pact. Dramatis personae sit outside the cap, as the server counts.
 */
export const takesHiredSwordPlace = (unit: WithTerms & { blood_pacted?: boolean | null }) =>
  !unit.blood_pacted && !isDramatisPersona(unit);

/**
 * An upkeep formula as a reminder ("Upkeep: 1 piece of wyrdstone"): what is owed after each battle
 * besides the gold the upkeep price charges. Nothing without a formula.
 */
export const upkeepReminder = (unit: { upkeep_cost_expression?: string | null }) =>
  unit.upkeep_cost_expression ? `Upkeep: ${unit.upkeep_cost_expression}` : "";
