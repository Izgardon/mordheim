import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { Checkbox } from "@components/checkbox";
import { ActionSearchDropdown } from "@components/action-search-input";
import { ChevronDown } from "lucide-react";
import CreateRaceDialog from "../../../../races/components/CreateRaceDialog";
import SearchableDropdown from "./SearchableDropdown";
import type { Race } from "../../../../races/types/race-types";
import type { Special } from "../../../../special/types/special-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HeroFormEntry } from "../../../types/warband-types";
import type { HeroValidationError, HeroValidationField } from "../../../utils/warband-utils";

const CASTER_SPECIAL_NAMES: Record<string, string> = { Wizard: "wizard", Priest: "priest" };

type TraitDropdownProps = {
  options: string[];
  selected: string[];
  onSelect: (value: string) => void;
  multi?: boolean;
  placeholder?: string;
  searchable?: boolean;
};

function TraitDropdown({ options, selected, onSelect, multi = false, placeholder = "Select...", searchable = false }: TraitDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const label = (() => {
    if (!selected.length) return <span className="text-muted-foreground">{placeholder}</span>;
    if (selected.length === 1) return selected[0];
    return <>{selected[0]} <span className="text-muted-foreground">+{selected.length - 1}</span></>;
  })();

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex h-7 items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-2 text-[10px] text-foreground transition-colors hover:border-primary/60"
        onClick={() => setIsOpen((o) => !o)}
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      <ActionSearchDropdown open={isOpen} className="mt-1 w-48 rounded-xl">
        <div className="p-1">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="mb-1 w-full rounded-lg border border-border/60 bg-background/70 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          )}
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">No matches.</p>
            ) : (
              filtered.map((option) =>
                multi ? (
                  <label
                    key={option}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent/25"
                  >
                    <Checkbox
                      checked={selected.includes(option)}
                      onChange={() => onSelect(option)}
                    />
                    {option}
                  </label>
                ) : (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onSelect(option); setIsOpen(false); setQuery(""); }}
                    className={`flex w-full items-center rounded-lg px-2 py-1 text-left text-xs transition-colors hover:bg-accent/25 ${
                      selected.includes(option) ? "text-accent font-semibold" : "text-foreground"
                    }`}
                  >
                    {option}
                  </button>
                )
              )
            )}
          </div>
        </div>
      </ActionSearchDropdown>
    </div>
  );
}

type UnitFormBase = HeroFormEntry & {
  upkeep_price?: string;
  blood_pacted?: boolean;
};

type UnitBasicInfoProps<T extends UnitFormBase> = {
  unit: T;
  index: number;
  campaignId: number;
  availableRaces: Race[];
  availableSpecials: Special[];
  availableSkills: Skill[];
  skillFields: readonly { key: string; label: string }[];
  inputClassName: string;
  onUpdate: (index: number, updater: (unit: T) => T) => void;
  onRaceCreated: (race: Race) => void;
  error?: HeroValidationError | null;
  priceLabel?: string;
  showUpkeepPrice?: boolean;
  upkeepLabel?: string;
  showBloodPacted?: boolean;
};

export default function UnitBasicInfo<T extends UnitFormBase>({
  unit,
  index,
  campaignId,
  availableRaces,
  availableSpecials,
  availableSkills,
  skillFields,
  inputClassName,
  onUpdate,
  onRaceCreated,
  error,
  priceLabel = "Recruit cost",
  showUpkeepPrice = false,
  upkeepLabel = "Upkeep price",
  showBloodPacted = false,
}: UnitBasicInfoProps<T>) {
  const [raceQuery, setRaceQuery] = useState(unit.race_name ?? "");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);
  const [isRaceListOpen, setIsRaceListOpen] = useState(false);

  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((s) => s.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

  useEffect(() => {
    setRaceQuery(unit.race_name ?? "");
  }, [unit.race_name, unit.race_id]);

  const hasFieldError = (field: HeroValidationField) =>
    Boolean(error?.fields?.includes(field));

  const matchingRaces = availableRaces.filter(
    (race) =>
      race.id !== unit.race_id &&
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
            value={unit.name}
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
            value={unit.unit_type}
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

      <div className="grid grid-cols-[3fr_2fr] gap-4 rounded-xl border border-border/60 bg-background/50 p-3">
        <div className="flex flex-col justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
            Available skills
          </p>
          <div className="flex min-h-[28px] flex-wrap items-end gap-3">
            {skillFields.filter((f) => f.key !== "Spc").map((field) => (
              <label key={field.key} className="flex flex-col items-center gap-1 text-xs text-foreground">
                {field.label}
                <Checkbox
                  checked={unit.available_skills[field.key]}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      available_skills: {
                        ...current.available_skills,
                        [field.key]: event.target.checked,
                      },
                    }))
                  }
                />
              </label>
            ))}
            <label className="flex flex-col items-center gap-1 text-xs text-foreground">
              Spc
              <Checkbox
                checked={unit.available_skills.Spc}
                onChange={(event) => {
                  const checked = event.target.checked;
                  onUpdate(index, (current) => {
                    const next = { ...current.available_skills, Spc: checked };
                    if (!checked) {
                      for (const t of skillTypeOptions) delete next[t];
                    }
                    return { ...current, available_skills: next };
                  });
                }}
              />
            </label>
            {unit.available_skills.Spc && (
              <TraitDropdown
                options={skillTypeOptions}
                selected={skillTypeOptions.filter((t) => unit.available_skills[t])}
                onSelect={(type) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    available_skills: {
                      ...current.available_skills,
                      [type]: !current.available_skills[type],
                    },
                  }))
                }
                multi
                searchable
                placeholder="Select types..."
              />
            )}
          </div>
        </div>
        <div className="flex flex-col justify-between border-l border-border/60 pl-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
            Traits
          </p>
          <div className="flex min-h-[28px] flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <Checkbox
                checked={unit.large}
                onChange={(event) =>
                  onUpdate(index, (current) => {
                    const checked = event.target.checked;
                    let specials = current.specials;
                    const hasLarge = specials.some((s) => s.name.trim().toLowerCase() === "large");
                    if (checked && !hasLarge) {
                      const match = availableSpecials.find((s) => s.name.trim().toLowerCase() === "large");
                      if (match) specials = [...specials, match];
                    } else if (!checked && hasLarge) {
                      specials = specials.filter((s) => s.name.trim().toLowerCase() !== "large");
                    }
                    return { ...current, large: checked, specials };
                  })
                }
            />
            Large
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <Checkbox
                checked={unit.caster !== "No"}
                onChange={(event) => {
                  const checked = event.target.checked;
                  const nextCaster = checked ? "Wizard" : "No";
                  onUpdate(index, (current) => {
                    let specials = current.specials;
                    for (const [casterType, normalizedName] of Object.entries(CASTER_SPECIAL_NAMES)) {
                      const shouldHave = nextCaster === casterType;
                      const alreadyHas = specials.some((s) => s.name.trim().toLowerCase() === normalizedName);
                      if (shouldHave && !alreadyHas) {
                        const match = availableSpecials.find((s) => s.name.trim().toLowerCase() === normalizedName);
                        if (match) specials = [...specials, match];
                      } else if (!shouldHave && alreadyHas) {
                        specials = specials.filter((s) => s.name.trim().toLowerCase() !== normalizedName);
                      }
                    }
                    return { ...current, caster: nextCaster, specials };
                  });
                }}
              />
              Caster
            </label>
            {unit.caster !== "No" && (
              <TraitDropdown
                options={["Wizard", "Priest"]}
                selected={[unit.caster]}
                onSelect={(value) =>
                  onUpdate(index, (current) => {
                    let specials = current.specials;
                    for (const [casterType, normalizedName] of Object.entries(CASTER_SPECIAL_NAMES)) {
                      const shouldHave = value === casterType;
                      const alreadyHas = specials.some((s) => s.name.trim().toLowerCase() === normalizedName);
                      if (shouldHave && !alreadyHas) {
                        const match = availableSpecials.find((s) => s.name.trim().toLowerCase() === normalizedName);
                        if (match) specials = [...specials, match];
                      } else if (!shouldHave && alreadyHas) {
                        specials = specials.filter((s) => s.name.trim().toLowerCase() !== normalizedName);
                      }
                    }
                    return { ...current, caster: value as HeroFormEntry["caster"], specials };
                  })
                }
              />
            )}
            {showBloodPacted ? (
              <label className="flex items-center gap-2 text-xs text-foreground">
                <Checkbox
                  checked={Boolean(unit.blood_pacted)}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      blood_pacted: event.target.checked,
                    }))
                  }
                />
                Bloodpacted
              </label>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex min-h-[28px] flex-wrap items-center gap-2">
            <Label className="text-sm font-semibold text-foreground">Experience</Label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Checkbox
                checked={unit.half_rate}
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
            step={unit.half_rate ? 0.5 : 1}
            value={unit.xp}
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
          <div className="flex min-h-[28px] flex-wrap items-center gap-2">
            <Label className="text-sm font-semibold text-foreground">{priceLabel}</Label>
          </div>
          <NumberInput
            min={0}
            value={unit.price}
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

      {showUpkeepPrice ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex min-h-[28px] flex-wrap items-center gap-2">
              <Label className="text-sm font-semibold text-foreground">{upkeepLabel}</Label>
            </div>
            <NumberInput
              min={0}
              value={unit.upkeep_price ?? "0"}
              onChange={(event) =>
                onUpdate(index, (current) => ({
                  ...current,
                  upkeep_price: event.target.value,
                }))
              }
              placeholder="0"
              className={inputClassName}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
