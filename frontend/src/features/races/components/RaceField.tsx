import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect } from "@/components/ui/search-select";
import { StatBoxes } from "@/components/ui/stat-boxes";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { raceOption, warnedLast } from "@/features/catalogue/search-options";
import { STAT_FIELDS, type StatKey } from "@/features/catalogue/utils/statblock";
import { useCatalogue, useCatalogueCache } from "@/lib/catalogue-queries";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { createRace } from "../api/races-api";
import type { Race, RaceCreatePayload } from "../types/race-types";

/** A race's maximums, always numbers: a human's to start with. */
type Maximums = Record<StatKey, string>;
const HUMAN = [4, 6, 6, 4, 4, 3, 6, 4, 9];
const humanMaximums = () =>
  Object.fromEntries(STAT_FIELDS.map(({ key }, i) => [key, String(HUMAN[i])])) as Maximums;
const digits = (value: string) => value.replace(/\D/g, "").slice(0, 2);

type RaceFieldProps = {
  campaignId: number;
  value: number | null;
  /** `edit_catalogue`: Add new makes a campaign race. */
  canCreate: boolean;
  /** The race picked (null: none), and its row. */
  onChange: (raceId: number | null, race: Race | null) => void;
  /** The race's text when no race matched it ("Daemon"): Add new starts with it as the name. */
  unmatched?: string;
  /** The caption's classes (a form's own caption style). */
  captionClassName?: string;
  className?: string;
};

/**
 * The unit's race (its profile maximums), one shared field (William, 7 Nov 2026: "race should be
 * a dropdown with a Add new button that shows a form with name and stat entry, don't need race
 * label til this is clicked"; "probably need this in custom unit form and templates"): the
 * campaign's races, the book's and its own, on the searchable select, and Add new, which opens a
 * small form, a name and its maximum profile, that makes the campaign's race and picks it.
 */
export default function RaceField({
  campaignId,
  value,
  canCreate,
  onChange,
  unmatched = "",
  captionClassName = "flex min-h-5 items-center",
  className,
}: RaceFieldProps) {
  const races = useCatalogue("races", campaignId).data ?? [];
  const settings = useSettingsById();
  const options = warnedLast(races.map((race) => raceOption(race, settings)));
  const current = races.find((race) => race.id === value);
  const cache = useCatalogueCache();
  const [custom, setCustom] = useState<{ name: string; max: Maximums } | null>(null);
  const [saving, setSaving] = useState(false);
  const openNew = (name: string) => setCustom({ name, max: humanMaximums() });

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
      onChange(race.id, race as Race);
      setCustom(null);
    } catch (error) {
      toast.error("Couldn't add the race.", { description: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1 text-xs font-bold text-muted-foreground",
          className
        )}
      >
        <span className={captionClassName}>Race</span>
        {/* one line, as tall as the fields beside it (William, 7 Nov 2026: "align race input in
            create custom unit visually its off and maybe too tall still?") */}
        <div className="flex min-w-0 items-stretch gap-1.5">
          <SearchSelect
            label="Race"
            className="min-w-0 flex-1"
            inputClassName="h-[34px]"
            oneLine
            placeholder="Search races"
            emptyText="No race matches."
            options={options}
            value={current ? raceOption(current, settings) : null}
            clearLabel="No race"
            onChange={(option) => {
              setCustom(null);
              const race = option ? races.find((row) => row.id === Number(option.id)) : null;
              onChange(race?.id ?? null, race ?? null);
            }}
            create={
              canCreate
                ? { label: (typed) => `Add “${typed}” as a new race`, onCreate: openNew }
                : undefined
            }
          />
          {canCreate && !custom ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-auto shrink-0"
              onClick={() => openNew(value === null ? unmatched : "")}
            >
              <Plus aria-hidden="true" />
              Add new
            </Button>
          ) : null}
        </div>
        {unmatched && value === null && !custom ? (
          <span className="text-[11px] font-medium text-text2">
            {`No race named “${unmatched}”.`}
          </span>
        ) : null}
      </div>
      {/* a sibling of the field, so it takes its own row in a form's grid */}
      {custom ? (
        <div
          role="group"
          aria-label="New race"
          className="col-span-full flex flex-col gap-2 border border-line bg-raised p-2.5"
        >
          <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
            Race name
            <Input
              inputSize="sm"
              autoFocus
              maxLength={60}
              value={custom.name}
              onChange={(event) => setCustom({ ...custom, name: event.target.value })}
            />
          </label>
          <span className="text-xs font-bold text-muted-foreground">Maximum profile</span>
          <StatBoxes
            numeric
            fields={STAT_FIELDS}
            values={custom.max}
            name={(stat) => `${stat} maximum`}
            className="grid-cols-9"
            onChange={(patch) => {
              const typed = Object.entries(patch).map(([key, next]) => [key, digits(next ?? "")]);
              setCustom({ ...custom, max: { ...custom.max, ...Object.fromEntries(typed) } });
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={saving || !custom.name.trim()}
              onClick={() => void create()}
            >
              {saving ? "Adding…" : "Add race"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCustom(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
