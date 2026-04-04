import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { Loader2 } from "lucide-react";
import { Button } from "@components/button";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";
import CreateRaceDialog from "@/features/races/components/CreateRaceDialog";
import UnitLoadout from "../../shared/forms/UnitLoadout";

import { listHiredSwordProfiles } from "@/features/bestiary/api/bestiary-api";
import type { HiredSwordProfileSummary } from "@/features/bestiary/types/bestiary-types";

import type { Race } from "@/features/races/types/race-types";
import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { Special } from "@/features/special/types/special-types";
import type { HiredSwordFormEntry } from "@/features/warbands/types/warband-types";
import { type NewHiredSwordForm as NewHiredSwordFormType } from "@/features/warbands/utils/warband-utils";

function formatCost(cost: number | null, expression: string): string {
  if (expression) return expression;
  if (cost !== null) return `${cost} gc`;
  return "-";
}

type AddHiredSwordFormProps = {
  campaignId: number;
  newHiredSwordForm: NewHiredSwordFormType;
  setNewHiredSwordForm: Dispatch<SetStateAction<NewHiredSwordFormType>>;
  newHiredSwordError: string;
  setNewHiredSwordError: (value: string) => void;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  canAddCustom?: boolean;
  onItemCreated: (index: number, item: Item) => void;
  raceQuery: string;
  setRaceQuery: (value: string) => void;
  isRaceDialogOpen: boolean;
  setIsRaceDialogOpen: (value: boolean) => void;
  matchingRaces: Race[];
  onAddHiredSword: () => Promise<void> | void;
  onAddFromPreset?: (profileId: number) => Promise<void>;
  isHiredSwordLimitReached: boolean;
  maxHiredSwords: number;
  onCancel: () => void;
  onRaceCreated: (race: Race) => void;
};

export default function AddHiredSwordForm({
  campaignId,
  newHiredSwordForm,
  setNewHiredSwordForm,
  newHiredSwordError,
  setNewHiredSwordError,
  availableItems,
  availableSkills,
  availableSpells,
  availableSpecials,
  canAddCustom = false,
  onItemCreated,
  raceQuery,
  setRaceQuery,
  isRaceDialogOpen,
  setIsRaceDialogOpen,
  matchingRaces,
  onAddHiredSword,
  onAddFromPreset,
  isHiredSwordLimitReached,
  maxHiredSwords,
  onCancel,
  onRaceCreated,
}: AddHiredSwordFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isNewRaceListOpen, setIsNewRaceListOpen] = useState(false);
  const raceBlurTimeoutRef = useRef<number | null>(null);

  const [presetQuery, setPresetQuery] = useState("");
  const [presetProfiles, setPresetProfiles] = useState<HiredSwordProfileSummary[]>([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [addingPresetId, setAddingPresetId] = useState<number | null>(null);
  const [presetError, setPresetError] = useState("");
  const [hasSelectedPreset, setHasSelectedPreset] = useState(false);

  useEffect(() => {
    setIsLoadingPresets(true);
    listHiredSwordProfiles({ campaignId })
      .then(setPresetProfiles)
      .catch(() => setPresetProfiles([]))
      .finally(() => setIsLoadingPresets(false));
  }, [campaignId]);

  const filteredPresets = useMemo(() => {
    const q = presetQuery.trim().toLowerCase();
    if (!q) return presetProfiles;
    return presetProfiles.filter((p) =>
      p.bestiary_entry.name.toLowerCase().includes(q)
    );
  }, [presetProfiles, presetQuery]);

  const handlePresetClick = async (profileId: number) => {
    if (!onAddFromPreset || addingPresetId !== null) return;
    setAddingPresetId(profileId);
    setPresetError("");
    try {
      await onAddFromPreset(profileId);
      const selectedProfile = presetProfiles.find((profile) => profile.id === profileId);
      if (selectedProfile) {
        setPresetQuery(selectedProfile.bestiary_entry.name);
      }
      setHasSelectedPreset(true);
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : "Failed to add preset.");
    } finally {
      setAddingPresetId(null);
    }
  };

  const handleCreateClick = async () => {
    setIsCreating(true);
    try { await onAddHiredSword(); } finally { setIsCreating(false); }
  };

  const inputClassName =
    "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground";

  const draftEntry = useMemo<HiredSwordFormEntry>(() => ({
    name: newHiredSwordForm.name,
    unit_type: newHiredSwordForm.unit_type,
    race_id: newHiredSwordForm.race_id,
    race_name: newHiredSwordForm.race_name,
    stats: newHiredSwordForm.stats,
    xp: newHiredSwordForm.xp,
    price: newHiredSwordForm.price,
    upkeep_price: newHiredSwordForm.upkeep_price,
    rating: newHiredSwordForm.rating,
    armour_save: newHiredSwordForm.armour_save,
    deeds: "",
    is_leader: false,
    trading_action: false,
    large: newHiredSwordForm.large,
    caster: newHiredSwordForm.caster,
    half_rate: newHiredSwordForm.half_rate,
    blood_pacted: newHiredSwordForm.blood_pacted,
    no_level_ups: false,
    available_skills: newHiredSwordForm.available_skills,
    items: newHiredSwordForm.items,
    skills: newHiredSwordForm.skills,
    spells: newHiredSwordForm.spells,
    specials: newHiredSwordForm.specials,
  }), [newHiredSwordForm]);

  const handleLoadoutUpdate = (_index: number, updater: (entry: HiredSwordFormEntry) => HiredSwordFormEntry) => {
    setNewHiredSwordForm((current) => {
      const updated = updater({
        ...draftEntry,
        name: current.name,
        unit_type: current.unit_type,
        race_id: current.race_id,
        race_name: current.race_name,
        stats: current.stats,
        xp: current.xp,
        price: current.price,
        upkeep_price: current.upkeep_price,
        rating: current.rating,
        armour_save: current.armour_save,
        large: current.large,
        caster: current.caster,
        half_rate: current.half_rate,
        blood_pacted: current.blood_pacted,
        available_skills: current.available_skills,
        items: current.items,
        skills: current.skills,
        spells: current.spells,
        specials: current.specials,
      });
      return {
        ...current,
        items: updated.items,
        skills: updated.skills,
        spells: updated.spells,
        specials: updated.specials,
        caster: updated.caster,
        large: updated.large,
      };
    });
  };

  const handleSkillCreated = (_index: number, skill: Skill) => {
    setNewHiredSwordForm((current) => {
      if (current.skills.some((entry) => entry.id === skill.id)) {
        return current;
      }
      return { ...current, skills: [...current.skills, skill] };
    });
  };

  const handleRaceFocus = () => {
    if (raceBlurTimeoutRef.current !== null) {
      window.clearTimeout(raceBlurTimeoutRef.current);
      raceBlurTimeoutRef.current = null;
    }
    setIsNewRaceListOpen(true);
  };

  const handleRaceBlur = () => {
    raceBlurTimeoutRef.current = window.setTimeout(() => {
      setIsNewRaceListOpen(false);
    }, 120);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-[rgba(12,9,6,0.92)] p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]">
      <CreateRaceDialog
        campaignId={campaignId}
        onCreated={(race) => {
          onRaceCreated(race);
          setNewHiredSwordForm((prev) => ({
            ...prev,
            race_id: race.id,
            race_name: race.name,
          }));
          setRaceQuery(race.name);
          setNewHiredSwordError("");
        }}
        open={isRaceDialogOpen}
        onOpenChange={setIsRaceDialogOpen}
        trigger={null}
      />

      {onAddFromPreset ? (
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Add from preset</Label>
          <Input
            type="search"
            value={presetQuery}
            onChange={(e) => setPresetQuery(e.target.value)}
            placeholder="Search presets..."
            className="max-w-sm"
          />
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border/60 bg-background/40">
            {isLoadingPresets ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Loading presets...</p>
            ) : filteredPresets.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {presetQuery ? "No presets match your search." : "No presets available."}
              </p>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredPresets.map((profile) => {
                  const isAdding = addingPresetId === profile.id;
                  const isDisabled = addingPresetId !== null;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handlePresetClick(profile.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {profile.bestiary_entry.name}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {isAdding ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <>
                            Hire: {formatCost(profile.hire_cost, profile.hire_cost_expression)}
                            {" · "}
                            Upkeep: {formatCost(profile.upkeep_cost, profile.upkeep_cost_expression)}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {presetError ? <p className="text-sm text-red-600">{presetError}</p> : null}
          {!hasSelectedPreset ? (
            <div className="flex items-center gap-2 pt-1">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or fill in manually</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Name</Label>
          <Input
            value={newHiredSwordForm.name}
            onChange={(event) => {
              setNewHiredSwordForm((prev) => ({
                ...prev,
                name: event.target.value,
              }));
              setNewHiredSwordError("");
            }}
            placeholder="Hired sword name"
          />
        </div>
        <div className="min-w-[160px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Type</Label>
          <Input
            value={newHiredSwordForm.unit_type}
            onChange={(event) => {
              setNewHiredSwordForm((prev) => ({
                ...prev,
                unit_type: event.target.value,
              }));
              setNewHiredSwordError("");
            }}
            placeholder="Hired Sword"
          />
        </div>
        <div className="min-w-[200px] flex-[1.2] space-y-2">
          <Label className="text-sm font-semibold text-foreground">Race</Label>
          <div className="relative">
            <ActionSearchInput
              value={raceQuery}
              onChange={(event) => {
                const value = event.target.value;
                setRaceQuery(value);
                setNewHiredSwordForm((prev) => ({
                  ...prev,
                  race_id: null,
                  race_name: "",
                }));
                setNewHiredSwordError("");
              }}
              placeholder="Search races..."
              onFocus={handleRaceFocus}
              onBlur={handleRaceBlur}
              actionLabel="Create"
              actionAriaLabel="Create race"
              actionClassName="border-border/60 bg-background/70 text-foreground hover:border-primary/60"
              onAction={() => setIsRaceDialogOpen(true)}
            />
            <ActionSearchDropdown open={isNewRaceListOpen} className="mt-1 rounded-xl">
              <div className="max-h-40 w-full overflow-y-auto p-1">
                {matchingRaces.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No matches yet.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {matchingRaces.map((race) => (
                      <button
                        key={race.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setNewHiredSwordForm((prev) => ({
                            ...prev,
                            race_id: race.id,
                            race_name: race.name,
                          }));
                          setRaceQuery(race.name);
                          setNewHiredSwordError("");
                          setIsNewRaceListOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/60 hover:bg-accent/25"
                      >
                        <span className="font-semibold">{race.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </ActionSearchDropdown>
          </div>
        </div>
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Hire price</Label>
          <NumberInput
            min={0}
            value={newHiredSwordForm.price}
            onChange={(event) =>
              setNewHiredSwordForm((prev) => ({
                ...prev,
                price: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Upkeep price</Label>
          <NumberInput
            min={0}
            value={newHiredSwordForm.upkeep_price}
            onChange={(event) =>
              setNewHiredSwordForm((prev) => ({
                ...prev,
                upkeep_price: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
        <div className="min-w-[140px] flex-1 space-y-2">
          <Label className="text-sm font-semibold text-foreground">Rating</Label>
          <NumberInput
            min={0}
            value={newHiredSwordForm.rating}
            onChange={(event) =>
              setNewHiredSwordForm((prev) => ({
                ...prev,
                rating: event.target.value,
              }))
            }
            placeholder="0"
          />
        </div>
      </div>
      <UnitLoadout
        unit={draftEntry}
        index={0}
        campaignId={campaignId}
        availableItems={availableItems}
        availableSkills={availableSkills}
        availableSpells={availableSpells}
        availableSpecials={availableSpecials}
        inputClassName={inputClassName}
        canAddCustom={canAddCustom}
        unitType="hiredswords"
        deferItemCommit
        reservedGold={0}
        onUpdate={handleLoadoutUpdate}
        onItemCreated={onItemCreated}
        onSkillCreated={handleSkillCreated}
      />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleCreateClick} disabled={isCreating}>
          {isCreating ? (<><Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />Creating...</>) : "Create hired sword"}
        </Button>
      </div>
      {newHiredSwordError ? <p className="text-sm text-red-600">{newHiredSwordError}</p> : null}
      {isHiredSwordLimitReached ? (
        <p className="text-xs text-muted-foreground">
          Maximum of {maxHiredSwords} hired swords reached.
        </p>
      ) : null}
    </div>
  );
}
