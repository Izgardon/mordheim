import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import SearchablePickerSection from "../SearchablePickerSection";

import type { BestiaryLinks, SelectedItem } from "../../hooks/useBestiaryLinks";

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A special rule created on the spot, in place of the special picker. */
function NewSpecialRule({ links }: { links: BestiaryLinks }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>Special Rules</Label>
      <div className="flex flex-col gap-2 rounded-md border border-input bg-background/60 p-3">
        <Input
          value={links.newSpecialName}
          onChange={(e) => links.setNewSpecialName(e.target.value)}
          placeholder="Rule name"
          autoFocus
        />
        <textarea
          value={links.newSpecialDescription}
          onChange={(e) => links.setNewSpecialDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className={TEXTAREA_CLASS}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            disabled={links.isSavingSpecial || !links.newSpecialName.trim()}
            onClick={links.createNewSpecial}
          >
            {links.isSavingSpecial ? "Saving..." : "Add rule"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={links.closeNewSpecial}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

/** An entry's special rules, skills, spells and equipment (with quantities). */
export default function BestiaryLinksFields({ links }: { links: BestiaryLinks }) {
  return (
    <>
      {links.isCreatingSpecial ? (
        <NewSpecialRule links={links} />
      ) : (
        <SearchablePickerSection
          label="Special Rules"
          placeholder="Search special rules..."
          items={links.available.specials}
          selected={links.specials}
          onSelect={links.addSpecial}
          onRemove={links.removeSpecial}
          onCreateNew={links.openNewSpecial}
          createNewLabel="Create new rule"
        />
      )}

      <SearchablePickerSection
        label="Skills"
        placeholder="Search skills..."
        items={links.available.skills}
        selected={links.skills}
        onSelect={links.addSkill}
        onRemove={links.removeSkill}
      />

      <SearchablePickerSection
        label="Spells"
        placeholder="Search spells..."
        items={links.available.spells}
        selected={links.spells}
        onSelect={links.addSpell}
        onRemove={links.removeSpell}
      />

      <SearchablePickerSection
        label="Equipment"
        placeholder="Search items..."
        items={links.available.items}
        selected={links.items}
        onSelect={links.addItem}
        onRemove={links.removeItem}
        renderSelectedExtra={(item) => (
          <input
            type="number"
            min={1}
            max={99}
            value={(item as SelectedItem).quantity}
            onChange={(e) => links.setItemQuantity(item.id, Number(e.target.value) || 1)}
            onClick={(e) => e.stopPropagation()}
            className="ml-1 h-5 w-10 rounded border border-input bg-background px-1 text-center text-xs"
            aria-label={`Quantity for ${item.name}`}
          />
        )}
      />
    </>
  );
}
