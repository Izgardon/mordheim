import type { SearchOption } from "@/components/ui/search-select";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import type {
  TemplateType,
  TemplateVariant,
  WarbandTemplateSummary,
} from "@/features/warband-templates/types/template-types";

/** A book warband type with the template that serves it (its variants, the one it presets). */
export type BookType = {
  type: TemplateType;
  templateId: number;
  templateName: string;
  variants: TemplateVariant[];
};

/** Every book type a template serves, by name: a workshop ticks every setting, so all of them. */
export function bookTypes(templates: WarbandTemplateSummary[]): BookType[] {
  const rows = templates.flatMap((template) =>
    template.types
      .filter((type) => !type.archived && type.campaign_id === null)
      .map((type) => ({
        type,
        templateId: template.id,
        templateName: template.name,
        variants: template.variants,
      }))
  );
  return rows.sort(
    (a, b) =>
      a.type.name.localeCompare(b.type.name) || a.type.source_code.localeCompare(b.type.source_code)
  );
}

/** A type on the search: its name, and its setting under it. */
export function bookTypeOption(row: BookType, settings: Map<number, Setting>): SearchOption {
  const setting = row.type.setting_id ? settings.get(row.type.setting_id)?.name : undefined;
  return {
    id: row.type.id,
    title: row.type.name,
    subtitle: setting ?? row.type.source_code,
    keywords: [row.templateName, row.type.source_code].join(" "),
  };
}

/** The variants a player picks from: none when the type always is one, or its template has none. */
export const variantsToPick = (row: BookType | null) =>
  row && !row.type.variant ? row.variants : [];

/** A template on the search (a new list copies one): its name, and its setting under it. */
export function templateOption(
  template: WarbandTemplateSummary,
  settings: Map<number, Setting>
): SearchOption {
  const setting = template.setting_id ? settings.get(template.setting_id)?.name : undefined;
  return {
    id: template.id,
    title: template.name,
    subtitle: [setting, template.source].filter(Boolean).join(" · "),
    keywords: template.types.map((type) => type.name).join(" "),
  };
}
