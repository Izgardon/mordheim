import { SpecialIcon } from "@/components/ui/game-icons";
import { SearchCombobox } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import type { Special } from "@/features/special/types/special-types";
import { useCatalogue } from "@/lib/catalogue-queries";

import { boonBaneOptions } from "../boon-bane-options";

/**
 * A new boon or bane, as a skill is picked: the campaign's general boons, banes and traits in the
 * search (a hired sword's or dramatis persona's own are left out), and the pick with its rules.
 */
export default function BoonBanePicker({
  campaignId,
  value,
  onChange,
}: {
  campaignId: number;
  value: Special | null;
  onChange: (special: Special | null) => void;
}) {
  const specials = useCatalogue("specials", campaignId).data ?? [];
  const settings = useSettingsById();

  if (value) {
    return (
      <div className="flex flex-col gap-1.5 border border-accent-line bg-accent-soft p-2.5">
        <span className="flex items-center gap-1.5 text-sm font-bold text-head">
          <SpecialIcon category={value.category} kind={value.kind} />
          {value.name}
          {value.type ? (
            <span className="font-normal text-muted-foreground">· {value.type}</span>
          ) : null}
          <button
            type="button"
            className="ml-auto text-xs font-bold text-accent-text hover:underline"
            onClick={() => onChange(null)}
          >
            Change
          </button>
        </span>
        <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-text2">
          {value.description}
        </p>
      </div>
    );
  }

  return (
    <SearchCombobox
      inline
      label="Search boons and banes"
      placeholder="Search boons and banes"
      emptyText="No boon or bane matches."
      options={boonBaneOptions(specials, settings)}
      onPick={(option) =>
        onChange(specials.find((special) => special.id === Number(option.id)) ?? null)
      }
    />
  );
}
