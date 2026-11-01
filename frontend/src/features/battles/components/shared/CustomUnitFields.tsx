import { Input } from "@/components/ui/input";
import { STAT_FIELDS } from "@/features/battles/components/prebattle/prebattle-types";
import type { CustomUnitDraftState } from "@/features/battles/hooks/useCustomUnitDraft";

/** "Sv" reads better than the roster's "AS" beside the other nine. */
const label = (key: string, fallback: string) => (key === "armour_save" ? "Sv" : fallback);

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
          <Input
            inputMode="numeric"
            value={value.rating}
            onChange={(event) =>
              changeDraft({ ...value, rating: event.target.value.replace(/[^\d]/g, "") })
            }
          />
        </label>
      </div>
      <div className="grid grid-cols-5 gap-1.5 min-[560px]:grid-cols-10">
        {STAT_FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex flex-col items-center gap-1 text-[10px] font-bold text-faint"
          >
            {label(field.key, field.label)}
            <Input
              inputSize="sm"
              inputMode="numeric"
              aria-label={label(field.key, field.label)}
              value={value.stats[field.key]}
              onChange={(event) => changeStat(field.key, event.target.value)}
              className="px-1 text-center font-mono"
            />
          </label>
        ))}
      </div>
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
