import { Button } from "@/components/ui/button";
import { FactLine, ReferenceDetail } from "@/features/reference/ReferenceDetail";
import { rowDomId } from "@/features/reference/ReferenceList";
import DiceTable from "@/features/warbands/components/roster/advance/DiceTable";
import RulesPanel from "@/features/warbands/components/roster/RulesPanel";

import { difficultyLabel, difficultyOf, loreOf, type SpellLore } from "../spell-lores";
import type { Spell } from "../types/spell-types";
import SpellFormDialog from "./SpellFormDialog";

type LoreSpellsProps = {
  campaignId: number;
  lore: SpellLore;
  /** Its spells' settings ("Mordheim", "Lustria"), each once. */
  settingNames: string[];
  /** The spell whose rules show (`?open=`). */
  openId: string | null;
  /** A spell's row: its rules open, or close when they are open. */
  onPick: (spellId: string) => void;
  onClose: () => void;
  /** Edit spell, for those who edit the catalogue. */
  edit: {
    typeOptions: string[];
    canDelete: boolean;
    onSaved: (spell: Spell) => void;
    onDeleted: () => void;
  } | null;
  isMobile: boolean;
};

/**
 * An open lore: its spells' settings, its D6 table, a clicked spell's rules under its row, with
 * Edit spell.
 */
export default function LoreSpells({
  lore,
  settingNames,
  openId,
  edit,
  ...props
}: LoreSpellsProps) {
  const rules = (spell: Spell) => (
    <div className="flex flex-col gap-2">
      <RulesPanel
        detail={{
          name: spell.name,
          kind: [loreOf(spell), spell.roll ? `D6 ${spell.roll}` : "", difficultyLabel(spell)]
            .filter(Boolean)
            .join(" · "),
          text: spell.description,
        }}
        onClose={props.onClose}
      />
      {edit ? (
        <SpellFormDialog
          campaignId={props.campaignId}
          spell={spell}
          typeOptions={edit.typeOptions}
          canDelete={edit.canDelete}
          onSaved={edit.onSaved}
          onDeleted={edit.onDeleted}
          trigger={
            <Button variant="secondary" className="min-h-10 self-start">
              Edit spell
            </Button>
          }
        />
      ) : null}
    </div>
  );

  // the list's full width (William, 7 Nov 2026: "spell and skill reference table expanded
  // sections should be full width")
  return (
    <ReferenceDetail isMobile={props.isMobile}>
      <FactLine facts={[{ label: "Setting", value: settingNames.join(", ") }]} />
      <DiceTable
        label={`${lore.name} spells`}
        columns={["D6", "Spell", "Difficulty"]}
        current={openId ?? undefined}
        onPick={props.onPick}
        rows={lore.spells.map((spell) => {
          const key = String(spell.id);
          return {
            key,
            id: rowDomId(key),
            roll: spell.roll ? String(spell.roll) : "–",
            result: spell.name,
            aside: difficultyOf(spell) || "–",
            detail: key === openId ? rules(spell) : undefined,
          };
        })}
      />
    </ReferenceDetail>
  );
}
