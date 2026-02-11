import { useEffect, useState } from "react";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { Checkbox } from "@components/checkbox";
import CreateRaceDialog from "../../../../races/components/CreateRaceDialog";
import SearchableDropdown from "./SearchableDropdown";
import type { Race } from "../../../../races/types/race-types";
import type { HeroFormEntry } from "../../../types/warband-types";
import type { HeroValidationError, HeroValidationField } from "../../../utils/warband-utils";

type HeroBasicInfoProps = {
  hero: HeroFormEntry;
  index: number;
  campaignId: number;
  availableRaces: Race[];
  inputClassName: string;
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onRaceCreated: (race: Race) => void;
  error?: HeroValidationError | null;
};

export default function HeroBasicInfo({
  hero,
  index,
  campaignId,
  availableRaces,
  inputClassName,
  onUpdate,
  onRaceCreated,
  error,
}: HeroBasicInfoProps) {
  const [raceQuery, setRaceQuery] = useState(hero.race_name ?? "");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);
  const [isRaceListOpen, setIsRaceListOpen] = useState(false);

  useEffect(() => {
    setRaceQuery(hero.race_name ?? "");
  }, [hero.race_name, hero.race_id]);

  const hasFieldError = (field: HeroValidationField) =>
    Boolean(error?.fields?.includes(field));

  const matchingRaces = availableRaces.filter(
    (race) =>
      race.id !== hero.race_id &&
      (!raceQuery.trim() || race.name.toLowerCase().includes(raceQuery.trim().toLowerCase()))
  );

  return (
    <>
      <CreateRaceDialog
        campaignId={campaignId}
        onCreated={(race) => {
          onRaceCreated(race);
          onUpdate(index, (current) => ({
            ...current,
            race_id: race.id,
            race_name: race.name,
          }));
          setRaceQuery(race.name);
        }}
        open={isRaceDialogOpen}
        onOpenChange={setIsRaceDialogOpen}
        trigger={null}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label
            className={[
              "text-sm font-semibold text-foreground",
              hasFieldError("name") ? "text-red-500" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Name
          </Label>
          <Input
            value={hero.name}
            onChange={(event) =>
              onUpdate(index, (current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Hero name"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <Label
            className={[
              "text-sm font-semibold text-foreground",
              hasFieldError("unit_type") ? "text-red-500" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Unit type
          </Label>
          <Input
            value={hero.unit_type}
            onChange={(event) =>
              onUpdate(index, (current) => ({
                ...current,
                unit_type: event.target.value,
              }))
            }
            placeholder="Leader, Champion"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <Label
            className={[
              "text-sm font-semibold text-foreground",
              hasFieldError("race_id") ? "text-red-500" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            Race
          </Label>
          <SearchableDropdown
            query={raceQuery}
            onQueryChange={(value) => {
              setRaceQuery(value);
              onUpdate(index, (current) => ({
                ...current,
                race_id: null,
                race_name: "",
              }));
            }}
            placeholder="Search races..."
            inputClassName={inputClassName}
            items={matchingRaces}
            isOpen={isRaceListOpen}
            onFocus={() => setIsRaceListOpen(true)}
            onBlur={() => setIsRaceListOpen(false)}
            onSelectItem={(race) => {
              onUpdate(index, (current) => ({
                ...current,
                race_id: race.id,
                race_name: race.name,
              }));
              setRaceQuery(race.name);
              setIsRaceListOpen(false);
            }}
            renderItem={(race) => <span className="font-semibold">{race.name}</span>}
            getItemKey={(race) => race.id}
            canCreate
            onCreateClick={() => setIsRaceDialogOpen(true)}
            createLabel="Create"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox
            checked={hero.large}
            onChange={(event) =>
              onUpdate(index, (current) => ({
                ...current,
                large: event.target.checked,
              }))
            }
          />
          Large
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <Checkbox
            checked={hero.caster}
            onChange={(event) =>
              onUpdate(index, (current) => ({
                ...current,
                caster: event.target.checked,
              }))
            }
          />
          Caster
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-semibold text-foreground">Experience</Label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Checkbox
                checked={hero.half_rate}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    half_rate: event.target.checked,
                  }))
                }
              />
              <span>(Half rate experience)</span>
            </label>
          </div>
            <NumberInput
              min={0}
              step={hero.half_rate ? 0.5 : 1}
              value={hero.xp}
              onChange={(event) =>
                onUpdate(index, (current) => ({
                ...current,
                xp: event.target.value,
              }))
            }
            placeholder="0"
            className={inputClassName}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Recruit cost</Label>
            <NumberInput
              min={0}
              value={hero.price}
              onChange={(event) =>
                onUpdate(index, (current) => ({
                ...current,
                price: event.target.value,
              }))
            }
            placeholder="0"
            className={inputClassName}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">Deeds</Label>
        <textarea
          value={hero.deeds}
          onChange={(event) =>
            onUpdate(index, (current) => ({
              ...current,
              deeds: event.target.value,
            }))
          }
          placeholder="Notable deeds, achievements, and scars..."
          rows={4}
          className={[
            "min-h-[110px] w-full border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)]",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>
    </>
  );
}

