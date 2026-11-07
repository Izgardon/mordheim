import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { StatBoxes } from "@/components/ui/stat-boxes";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { raceOption, warnedLast } from "@/features/catalogue/search-options";
import { STAT_FIELDS, type StatKey } from "@/features/catalogue/utils/statblock";
import { createRace } from "@/features/races/api/races-api";
import type { Race, RaceCreatePayload } from "@/features/races/types/race-types";
import { useCatalogue, useCatalogueCache } from "@/lib/catalogue-queries";
import { getErrorMessage } from "@/lib/get-error-message";

/** A race's maximums, always numbers: a human's to start with. */
type Maximums = Record<StatKey, string>;
const HUMAN = [4, 6, 6, 4, 4, 3, 6, 4, 9];
const humanMaximums = () =>
  Object.fromEntries(STAT_FIELDS.map(({ key }, i) => [key, String(HUMAN[i])])) as Maximums;
const digits = (value: string) => value.replace(/\D/g, "").slice(0, 2);

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
  const [custom, setCustom] = useState<{ name: string; max: Maximums } | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!custom?.name.trim()) return;
    setSaving(true);
    try {
      const body = Object.fromEntries(
        STAT_FIELDS.map(({ key }) => [key, Number(custom.max[key]) || 0])
      );
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
    <>
      <div className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
        <span className="flex min-h-5 items-center">Race</span>
        <SearchSelect
          label="Race"
          className="flex-1"
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
                  onCreate: (typed) => setCustom({ name: typed, max: humanMaximums() }),
                }
              : undefined
          }
        />
      </div>
      {/* a sibling of the field, so it takes its own row in the form's grid */}
      {custom ? (
        <div className="col-span-full flex flex-col gap-2 border border-line bg-raised p-2.5">
          <Input
            inputSize="sm"
            aria-label="Custom race name"
            placeholder="Race name"
            value={custom.name}
            onChange={(event) => setCustom({ ...custom, name: event.target.value })}
          />
          <span className="text-[11px] text-faint">Maximums</span>
          <StatBoxes
            numeric
            fields={STAT_FIELDS}
            values={custom.max}
            name={(stat) => `${stat} maximum`}
            className="grid-cols-9"
            onChange={(patch) => {
              const typed = Object.entries(patch).map(([key, value]) => [key, digits(value ?? "")]);
              setCustom({ ...custom, max: { ...custom.max, ...Object.fromEntries(typed) } });
            }}
          />
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
    </>
  );
}
