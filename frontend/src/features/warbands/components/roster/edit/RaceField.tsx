import { useState } from "react";
import { toast } from "sonner";

import { NumberInput } from "@/components/ui/number-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { raceOption, warnedLast } from "@/features/catalogue/search-options";
import { createRace } from "@/features/races/api/races-api";
import type { Race, RaceCreatePayload } from "@/features/races/types/race-types";
import { useCatalogue, useCatalogueCache } from "@/lib/catalogue-queries";
import { getErrorMessage } from "@/lib/get-error-message";

const MAXIMUMS = [
  ["M", "movement"],
  ["WS", "weapon_skill"],
  ["BS", "ballistic_skill"],
  ["S", "strength"],
  ["T", "toughness"],
  ["W", "wounds"],
  ["I", "initiative"],
  ["A", "attacks"],
  ["Ld", "leadership"],
] as const;
const HUMAN = [4, 6, 6, 4, 4, 3, 6, 4, 9];

/**
 * The unit's race (its profile maximums) on the searchable select, its maximums as the subtitle,
 * or a custom race made here from what was typed: a name and its maximums, added to the
 * campaign's races (needs `edit_catalogue`).
 */
export default function RaceField({
  campaignId,
  value,
  canCreate,
  onChange,
}: {
  campaignId: number;
  value: number | null;
  canCreate: boolean;
  onChange: (raceId: number | null) => void;
}) {
  const races = useCatalogue("races", campaignId).data ?? [];
  const settings = useSettingsById();
  const options = warnedLast(races.map((race) => raceOption(race, settings)));
  const current = races.find((race) => race.id === value);
  const cache = useCatalogueCache();
  const [custom, setCustom] = useState<{ name: string; max: number[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!custom?.name.trim()) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(MAXIMUMS.map(([, field], i) => [field, custom.max[i]]));
      const race = await createRace({
        ...(body as Omit<RaceCreatePayload, "name" | "campaign_id">),
        name: custom.name.trim(),
        campaign_id: campaignId,
      });
      cache.upsert("races", campaignId, race as Race);
      onChange(race.id);
      setCustom(null);
    } catch (error) {
      toast.error("Couldn't add the race.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      <span>Race</span>
      <SearchSelect
        label="Race"
        placeholder="Search races"
        emptyText="No race matches."
        options={options}
        value={current ? raceOption(current, settings) : null}
        clearLabel="No race"
        onChange={(option) => {
          setCustom(null);
          onChange(option ? Number(option.id) : null);
        }}
        create={
          canCreate
            ? {
                label: (typed) => `Add “${typed}” as a custom race`,
                onCreate: (typed) => setCustom({ name: typed, max: [...HUMAN] }),
              }
            : undefined
        }
      />
      {custom ? (
        <div className="flex flex-col gap-2 border border-line bg-raised p-2.5">
          <Input
            inputSize="sm"
            aria-label="Custom race name"
            placeholder="Race name"
            value={custom.name}
            onChange={(event) => setCustom({ ...custom, name: event.target.value })}
          />
          <span className="text-[11px] text-faint">Maximums</span>
          <div className="grid grid-cols-9 gap-1">
            {MAXIMUMS.map(([key], i) => (
              <label
                key={key}
                className="flex flex-col items-center gap-0.5 text-[10px] text-faint"
              >
                {key}
                <NumberInput
                  inputSize="sm"
                  className="px-0.5 text-center font-mono"
                  value={String(custom.max[i])}
                  onChange={(event) => {
                    const max = [...custom.max];
                    max[i] = Number(event.target.value) || 0;
                    setCustom({ ...custom, max });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={saving || !custom.name.trim()}
              onClick={() => void create()}
            >
              Add race
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCustom(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
