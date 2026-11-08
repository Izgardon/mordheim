import { SpecialIcon, type SpecialCategory, type SpecialKind } from "@/components/ui/game-icons";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";

import type { BestiaryLinks, SelectedItem } from "../../hooks/useBestiaryLinks";
import NewSpecialRule from "./NewSpecialRule";

type Linked = {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  /** A special's: boon, bane or trait. */
  kind?: SpecialKind;
  /** A special's: injury, mutation, aura or body. */
  category?: SpecialCategory;
};

const linkOption = (entry: Linked): SearchOption => ({
  id: entry.id,
  title: entry.name,
  icon: entry.kind ? <SpecialIcon category={entry.category} kind={entry.kind} /> : undefined,
  subtitle: entry.type || entry.description?.slice(0, 80) || undefined,
});

/** One of the entry's lists on the searchable select: what it has, and Add. */
function LinkPicker<T extends Linked>({
  label,
  noun,
  items,
  selected,
  onSelect,
  onRemove,
  onCreateNew,
  createNewLabel,
  chipExtra,
}: {
  label: string;
  noun: string;
  items: T[];
  selected: T[];
  onSelect: (item: T) => void;
  onRemove: (id: number) => void;
  onCreateNew?: (typed: string) => void;
  createNewLabel?: string;
  chipExtra?: (item: T) => React.ReactNode;
}) {
  const byId = new Map<number | string, T>([...items, ...selected].map((item) => [item.id, item]));
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <SearchMultiSelect
        addLabel={`Add ${noun}`}
        placeholder={`Search ${noun}s`}
        emptyText={`No ${noun} matches.`}
        options={[...items].sort((a, b) => a.name.localeCompare(b.name)).map(linkOption)}
        values={selected.map(linkOption)}
        chipExtra={chipExtra ? (option) => chipExtra(byId.get(option.id) as T) : undefined}
        onChange={(next) => {
          const ids = new Set(next.map((option) => option.id));
          for (const item of selected) if (!ids.has(item.id)) onRemove(item.id);
          for (const option of next)
            if (!selected.some((item) => item.id === option.id)) onSelect(byId.get(option.id) as T);
        }}
        create={
          onCreateNew
            ? { label: (typed) => `${createNewLabel} “${typed}”`, onCreate: onCreateNew }
            : undefined
        }
      />
    </div>
  );
}

/** The lists a form shows: its rules (boons and banes), skills, spells and equipment. */
export type LinkPart = "rules" | "skills" | "spells" | "equipment";
const ALL_PARTS: LinkPart[] = ["rules", "skills", "spells", "equipment"];

/**
 * An entry's boons and banes, skills, spells and equipment (with quantities); `parts` picks
 * which, for a form that sets them out in its own sections (a hired sword's).
 */
export default function BestiaryLinksFields({
  links,
  parts = ALL_PARTS,
}: {
  links: BestiaryLinks;
  parts?: LinkPart[];
}) {
  return (
    <>
      {!parts.includes("rules") ? null : links.isCreatingSpecial ? (
        <NewSpecialRule links={links} />
      ) : (
        <LinkPicker
          label="Boons & Banes"
          noun="boon or bane"
          items={links.available.specials}
          selected={links.specials}
          onSelect={links.addSpecial}
          onRemove={links.removeSpecial}
          onCreateNew={links.openNewSpecial}
          createNewLabel="Create new rule"
        />
      )}
      {parts.includes("skills") ? (
        <LinkPicker
          label="Skills"
          noun="skill"
          items={links.available.skills}
          selected={links.skills}
          onSelect={links.addSkill}
          onRemove={links.removeSkill}
        />
      ) : null}
      {parts.includes("spells") ? (
        <LinkPicker
          label="Spells"
          noun="spell"
          items={links.available.spells}
          selected={links.spells}
          onSelect={links.addSpell}
          onRemove={links.removeSpell}
        />
      ) : null}
      {parts.includes("equipment") ? (
        <LinkPicker
          label="Equipment"
          noun="item"
          items={links.available.items}
          selected={links.items}
          onSelect={links.addItem}
          onRemove={links.removeItem}
          chipExtra={(item) => (
            <NumberInput
              compact
              inputSize="sm"
              min={1}
              max={links.maxQuantity}
              value={(item as SelectedItem).quantity}
              onChange={(e) => links.setItemQuantity(item.id, Number(e.target.value) || 1)}
              containerClassName="ml-1 h-8"
              className="w-10 text-xs"
              aria-label={`Quantity for ${item.name}`}
            />
          )}
        />
      ) : null}
    </>
  );
}
