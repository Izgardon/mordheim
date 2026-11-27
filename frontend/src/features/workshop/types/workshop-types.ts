import type { TemplateVariant } from "@/features/warband-templates/types/template-types";

/** A warband type as the workshop names it. */
export type WorkshopType = { id: number; name: string };

/**
 * One of the server's warnings, in its words (`custom_content_added`, `custom_content_archived`,
 * `not_in_play`, `left_out`, `list_serves_none`...), with the names it is about.
 */
export type WorkshopWarning = { code: string; message: string; names?: string[] };

/** `GET workshop/`: a warband in my workshop (its id the warband's, `campaign_id` the workshop's). */
export type WorkshopWarbandRow = {
  id: number;
  campaign_id: number;
  name: string;
  warband_type: WorkshopType | null;
  /** The list it reads (one of my lists, or the book's template). */
  template_id: number | null;
  /** It reads no list at all: every unit made by hand. */
  no_list: boolean;
  share_code: string;
  updated_at: string;
};

/** `GET workshop/`: a warband list in my workshop (its id the template's). */
export type WorkshopListRow = {
  id: number;
  campaign_id: number;
  name: string;
  warband_types: (WorkshopType & { variant: string })[];
  variants: TemplateVariant[];
  share_code: string;
  updated_at: string;
};

/** `GET workshop/`: my workshop (its id null before my first use), its warbands and lists. */
export type Workshop = {
  id: number | null;
  warbands: WorkshopWarbandRow[];
  lists: WorkshopListRow[];
};

/** A warband or list made in my workshop, or copied into it, with what its making warned of. */
export type MadeInWorkshop =
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
      /** Its running cost (a workshop warband has no budget). */
      cost: number;
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
  list_id?: number;
  list_code?: string;
  /** Raised from no list: its own most warriors, every unit made by hand. */
  no_list?: boolean;
  max_units?: number;
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
