import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import { useCatalogue } from "@/lib/catalogue-queries";

/**
 * The spell lores he casts from (`available_spell_types`, copied from his template fighter): the
 * level-up's spell picker offers them first. Any lore of the campaign's spells can be added.
 */
export default function SpellLoresField({
  campaignId,
  value,
  onChange,
}: {
  campaignId: number;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const spells = useCatalogue("spells", campaignId).data ?? [];
  const lores = [
    ...new Set(spells.map((spell) => spell.type?.trim() ?? "").filter(Boolean)),
  ].sort();
  const option = (name: string): SearchOption => ({ id: name, title: name });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        Spell lores
      </span>
      <SearchMultiSelect
        addLabel="Add a spell lore"
        placeholder="Search spell lores"
        emptyText="No lore matches."
        options={lores.map(option)}
        values={value.map(option)}
        onChange={(next) => onChange(next.map((entry) => String(entry.id)))}
      />
    </div>
  );
}
