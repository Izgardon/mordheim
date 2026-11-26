/** A warband type as the workshop names it. */
export type WorkshopType = { id: number; name: string };

/** One of the server's warnings, in its words (`list_serves_none`, `not_in_play`, `over_budget`...). */
export type WorkshopWarning = { code: string; message: string };

/** `GET workshop/`: a custom warband of mine (its workshop's id is its campaign's). */
export type WorkshopWarbandRow = {
  id: number;
  campaign_id: number;
  warband_id: number | null;
  name: string;
  warband_type: WorkshopType | null;
  cost: number;
  budget: number;
  share_code: string;
  updated_at: string;
};

/** `GET workshop/`: a custom warband list of mine (a template in its own workshop). */
export type WorkshopListRow = {
  id: number;
  campaign_id: number;
  template_id: number | null;
  name: string;
  warband_types: WorkshopType[];
  share_code: string;
  updated_at: string;
};

export type WorkshopRows = { warbands: WorkshopWarbandRow[]; lists: WorkshopListRow[] };

/** A new workshop of mine (made, or a copy imported by code), with what its making warned of. */
export type MadeWorkshop =
  | (WorkshopWarbandRow & { kind: "warband"; warnings: WorkshopWarning[] })
  | (WorkshopListRow & { kind: "list"; warnings: WorkshopWarning[] });

/** `GET workshop/shared/<code>/`: what a code shares, for anyone signed in. */
export type SharedPreview =
  | {
      kind: "warband";
      share_code: string;
      maker: string;
      name: string;
      warband_type: WorkshopType | null;
      cost: number;
      budget: number;
      heroes: number;
      henchmen: number;
      hired_swords: number;
    }
  | {
      kind: "list";
      share_code: string;
      maker: string;
      name: string;
      warband_types: (WorkshopType & { variant: string })[];
      variants: { key: string; name: string }[];
    };

export type MakeWarbandBody = {
  name: string;
  warband_type_id?: number;
  template_variant?: string;
  list_code?: string;
};

export type MakeListBody = { name: string; copy_of_template_id?: number };

/** `POST campaigns/<id>/warbands/import/`: the warband made, its list's copy, the gold left. */
export type ImportedWarband = {
  warband_id: number;
  template_id: number | null;
  gold: number;
  warnings: WorkshopWarning[];
};

/** `POST campaigns/<id>/warband-templates/import/`: the campaign's own copy of the list. */
export type ImportedList = { template_id: number; name: string; warnings: WorkshopWarning[] };

/** A workshop warband's cost against its budget, from its sheet (null for a campaign's warband). */
export type WorkshopFacts = { cost: number; budget: number; share_code?: string };
