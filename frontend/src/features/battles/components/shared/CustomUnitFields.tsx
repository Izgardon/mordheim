import { NumberInput } from "@/components/ui/number-input";
import { Input } from "@/components/ui/input";
import { StatBoxes } from "@/components/ui/stat-boxes";
import { BATTLE_STAT_BOXES } from "@/features/battles/components/prebattle/prebattle-types";
import type { CustomUnitDraftState } from "@/features/battles/hooks/useCustomUnitDraft";

/**
 * A temporary unit's fields (pre-battle and Add a unit in the battle): its name, type and rating,
 * and its ten stats. The draft and its error live in `useCustomUnitDraft`.
 */
export default function CustomUnitFields({ draft }: { draft: CustomUnitDraftState }) {
  const { draft: value, changeDraft, changeStat, error } = draft;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 min-[560px]:grid-cols-[2fr_2fr_1fr]">
        <label className="flex flex-col gap-1 text-xs font-bold text-text2">
          Name
          <Input
            value={value.name}
            onChange={(event) => changeDraft({ ...value, name: event.target.value })}
            placeholder="Unit name"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-text2">
          Type
          <Input
            value={value.unitType}
            onChange={(event) => changeDraft({ ...value, unitType: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-text2">
          Rating
          <NumberInput
            value={value.rating}
            onChange={(event) =>
              changeDraft({ ...value, rating: event.target.value.replace(/[^\d]/g, "") })
            }
          />
        </label>
      </div>
      <StatBoxes
        numeric
        fields={BATTLE_STAT_BOXES}
        values={value.stats}
        onChange={(patch) => {
          for (const field of BATTLE_STAT_BOXES) {
            const typed = patch[field.key];
            if (typed !== undefined) changeStat(field.key, typed);
          }
        }}
      />
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
