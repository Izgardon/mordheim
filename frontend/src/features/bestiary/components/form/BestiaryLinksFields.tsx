import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SpecialKindIcon, type SpecialKind } from "@/components/ui/game-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";

import type { BestiaryLinks, SelectedItem } from "../../hooks/useBestiaryLinks";

const TEXTAREA_CLASS =
  "min-h-[120px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const SPECIAL_KINDS: [SpecialKind, string][] = [
  ["boon", "Boon"],
  ["bane", "Bane"],
  ["trait", "Trait"],
];

type Linked = {
  id: number;
  name: string;
  type?: string | null;
  description?: string | null;
  /** A special's: boon, bane or trait. */
  kind?: SpecialKind;
};

const linkOption = (entry: Linked): SearchOption => ({
  id: entry.id,
  title: entry.name,
  icon: entry.kind ? (
    <SpecialKindIcon kind={entry.kind} className="text-kind-special" />
  ) : undefined,
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

/** A boon, bane or trait created on the spot, in place of the picker (a trait unless picked). */
function NewSpecialRule({ links }: { links: BestiaryLinks }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Boons & Banes</Label>
      <div className="flex flex-col gap-2 border border-border bg-surface p-3">
        <Input
          value={links.newSpecialName}
          onChange={(e) => links.setNewSpecialName(e.target.value)}
          placeholder="Rule name"
          autoFocus
        />
        <textarea
          value={links.newSpecialDescription}
          onChange={(e) => links.setNewSpecialDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className={TEXTAREA_CLASS}
        />
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
          {SPECIAL_KINDS.map(([kind, label]) => (
            <Chip
              key={kind}
              pressed={links.newSpecialKind === kind}
              onClick={() => links.setNewSpecialKind(kind)}
            >
              <SpecialKindIcon kind={kind} />
              {label}
            </Chip>
          ))}
        </div>
        {links.specialError ? (
          <p role="alert" className="text-xs text-danger">
            {links.specialError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={links.isSavingSpecial || !links.newSpecialName.trim()}
            onClick={links.createNewSpecial}
          >
            {links.isSavingSpecial ? "Saving..." : "Add rule"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={links.closeNewSpecial}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/** An entry's boons and banes, skills, spells and equipment (with quantities). */
export default function BestiaryLinksFields({ links }: { links: BestiaryLinks }) {
  return (
    <>
      {links.isCreatingSpecial ? (
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

      <LinkPicker
        label="Skills"
        noun="skill"
        items={links.available.skills}
        selected={links.skills}
        onSelect={links.addSkill}
        onRemove={links.removeSkill}
      />

      <LinkPicker
        label="Spells"
        noun="spell"
        items={links.available.spells}
        selected={links.spells}
        onSelect={links.addSpell}
        onRemove={links.removeSpell}
      />

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
    </>
  );
}
