import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SpecialIcon, type SpecialCategory, type SpecialKind } from "@/components/ui/game-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { BestiaryLinks } from "../../hooks/useBestiaryLinks";

const TEXTAREA_CLASS =
  "min-h-[120px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const SPECIAL_KINDS: [SpecialKind, string][] = [
  ["boon", "Boon"],
  ["bane", "Bane"],
  ["trait", "Trait"],
];

const SPECIAL_CATEGORIES: [SpecialCategory, string][] = [
  ["injury", "Injury"],
  ["mutation", "Mutation"],
  ["aura", "Aura"],
  ["body", "Body"],
];

/** The new rule's category, each with its icon in the kind picked. */
function CategorySelect({ links }: { links: BestiaryLinks }) {
  return (
    <Select
      value={links.newSpecialCategory}
      onValueChange={(value) => links.setNewSpecialCategory(value as SpecialCategory)}
    >
      <SelectTrigger aria-label="Category" className="h-9 w-auto min-w-[150px] md:h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SPECIAL_CATEGORIES.map(([category, label]) => (
          <SelectItem key={category} value={category}>
            <span className="flex items-center gap-1.5">
              <SpecialIcon category={category} kind={links.newSpecialKind} />
              {label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A boon, bane or trait created on the spot, in place of the picker (a trait and an aura unless
 * picked).
 */
export default function NewSpecialRule({ links }: { links: BestiaryLinks }) {
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
        <div className="flex flex-wrap items-center gap-1.5">
          <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
            {SPECIAL_KINDS.map(([kind, label]) => (
              <Chip
                key={kind}
                pressed={links.newSpecialKind === kind}
                onClick={() => links.setNewSpecialKind(kind)}
              >
                <SpecialIcon category={links.newSpecialCategory} kind={kind} />
                {label}
              </Chip>
            ))}
          </div>
          <CategorySelect links={links} />
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
