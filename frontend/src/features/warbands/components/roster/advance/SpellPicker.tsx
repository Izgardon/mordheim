import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SearchCombobox } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { spellOption, warnedLast } from "@/features/catalogue/search-options";
import type { Spell } from "@/features/spells/types/spell-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import { spellRollResult } from "./advance-table";
import DiceTable from "./DiceTable";
import RollField from "./RollField";

/** A spell an advance gives: rolled on a lore's table, or picked by hand. */
export type SpellChoice =
  | { mode: "roll"; lore: string; roll: number; spell: Spell; known: boolean; difficulty: string }
  | { mode: "pick"; spell: Spell };

const fold = (text?: string | null) => (text ?? "").trim().toLowerCase();

/**
 * A new spell, guided (William): pick one of the lores he already has a spell from and roll a D6
 * on its table; a spell he knows gets 1 easier for him ("Difficulty 7 → 6"). With no spells yet
 * any lore will do, with a warning. "Pick instead" chooses any spell by hand, with a warning.
 */
export default function SpellPicker({
  campaignId,
  known,
  value,
  onChange,
}: {
  campaignId: number;
  /** The spells he has. */
  known: Spell[];
  value: SpellChoice | null;
  onChange: (choice: SpellChoice | null) => void;
}) {
  const spells = useCatalogue("spells", campaignId).data ?? [];
  const settings = useSettingsById();
  const own = [...new Set(known.map((spell) => spell.type?.trim()).filter(Boolean))] as string[];
  const tabled = [...new Set(spells.filter((s) => s.roll).map((s) => s.type?.trim() ?? ""))];
  const lores = own.length ? own : tabled.filter(Boolean).sort();
  const [lore, setLore] = useState<string | null>(lores.length === 1 ? lores[0] : null);
  const [picking, setPicking] = useState(value?.mode === "pick");
  const table = spells
    .filter((spell) => lore && fold(spell.type) === fold(lore) && spell.roll)
    .sort((a, b) => (a.roll ?? 0) - (b.roll ?? 0));
  const roll = value?.mode === "roll" ? value.roll : null;

  const rolled = (next: number | null) => {
    const result = lore && next !== null ? spellRollResult(table, known, next) : null;
    onChange(result && lore ? { mode: "roll", lore, roll: next!, ...result } : null);
  };

  if (picking) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-danger">Picked by hand, not rolled</span>
        {value?.mode === "pick" ? (
          <span className="text-sm font-bold text-head">
            {value.spell.name}
            <span className="font-normal text-muted-foreground"> · {value.spell.type}</span>
          </span>
        ) : (
          <SearchCombobox
            inline
            label="Search spells"
            placeholder="Search spells"
            emptyText="No spell matches."
            options={warnedLast(spells.map((spell) => spellOption(spell, settings)))}
            onPick={(option) => {
              const spell = spells.find((entry) => entry.id === Number(option.id));
              onChange(spell ? { mode: "pick", spell } : null);
            }}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            setPicking(false);
            onChange(null);
          }}
        >
          Roll instead
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {own.length ? null : (
        <span className="text-xs font-semibold text-danger">He knows no lore yet: any lore</span>
      )}
      <div role="group" aria-label="Lores" className="flex flex-wrap gap-1.5">
        {lores.map((name) => (
          <Chip
            key={name}
            pressed={lore === name}
            onClick={() => {
              setLore(name);
              onChange(null);
            }}
          >
            {name}
          </Chip>
        ))}
      </div>
      {lore ? (
        <>
          <RollField dice={1} value={roll} onChange={rolled} />
          <DiceTable
            label={`${lore} spells`}
            current={value?.mode === "roll" ? String(value.spell.id) : undefined}
            onPick={(key) => {
              const spell = table.find((entry) => String(entry.id) === key);
              if (spell?.roll) rolled(spell.roll);
            }}
            rows={table.map((spell) => ({
              key: String(spell.id),
              roll: String(spell.roll),
              result: spell.name,
              aside: spellRollResult(table, known, spell.roll ?? 0)?.difficulty,
            }))}
          />
        </>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => {
          setPicking(true);
          onChange(null);
        }}
      >
        Pick instead
      </Button>
    </div>
  );
}
