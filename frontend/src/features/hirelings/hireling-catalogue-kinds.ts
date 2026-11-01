/**
 * The two kinds a warband hires as hirelings, as their catalogue pages, forms and the warband's
 * Hire dialog name them. "Hireling" is the code's word only: the site says "Hired sword" and
 * "Dramatis persona". The kind is also the catalogue list's key and the API path.
 */
export type HirelingCatalogueKind = "hired-swords" | "dramatis-personae";

/** What the warband's hire names as its `source`. */
export type HireSource = "hired_sword" | "dramatis_persona";

export type HirelingCatalogueConfig = {
  kind: HirelingCatalogueKind;
  source: HireSource;
  /** A dramatis persona's terms: how long he stays, and what he is paid in. */
  hasPersonaTerms: boolean;
  /** The type a special created on the spot in the form takes. */
  specialType: string;
  labels: {
    /** Page title and nav: "Hired Swords". */
    title: string;
    /** "hired sword": in sentences ("Delete hired sword"). */
    noun: string;
    /** "Hired sword": a card's kind line. */
    singular: string;
    add: string;
    search: string;
    /** The list says this when the catalogue holds none at all. */
    emptyTitle: string;
    /** A search that matched none: "No hired swords match". */
    noMatches: string;
    /** A form's name placeholder. */
    namePlaceholder: string;
  };
};

export const HIRED_SWORDS: HirelingCatalogueConfig = {
  kind: "hired-swords",
  source: "hired_sword",
  hasPersonaTerms: false,
  specialType: "Hired Sword",
  labels: {
    title: "Hired Swords",
    noun: "hired sword",
    singular: "Hired sword",
    add: "Add hired sword",
    search: "Search hired swords",
    emptyTitle: "No hired swords yet",
    noMatches: "No hired swords match",
    namePlaceholder: "Hired sword name",
  },
};

export const DRAMATIS_PERSONAE: HirelingCatalogueConfig = {
  kind: "dramatis-personae",
  source: "dramatis_persona",
  hasPersonaTerms: true,
  specialType: "Dramatis Persona",
  labels: {
    title: "Dramatis Personae",
    noun: "dramatis persona",
    singular: "Dramatis persona",
    add: "Add dramatis persona",
    search: "Search dramatis personae",
    emptyTitle: "No dramatis personae yet",
    noMatches: "No dramatis personae match",
    namePlaceholder: "Dramatis persona name",
  },
};

export const HIRELING_CATALOGUES: Record<HirelingCatalogueKind, HirelingCatalogueConfig> = {
  "hired-swords": HIRED_SWORDS,
  "dramatis-personae": DRAMATIS_PERSONAE,
};

/** The race shown for an entry: the catalogue's, or the source's text when none matched. */
export const hirelingRace = (entry: { race_name?: string | null; race_label?: string | null }) =>
  entry.race_name || entry.race_label || "";
