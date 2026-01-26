import { useEffect, useMemo, useState } from "react";

// components
import { ActionSearchInput } from "@components/action-search-input";
import { Button } from "@components/button";
import { Input } from "@components/input";
import { Label } from "@components/label";
import CreateItemDialog from "../../items/components/CreateItemDialog";
import CreateRaceDialog from "../../races/components/CreateRaceDialog";
import CreateSkillDialog from "../../skills/components/CreateSkillDialog";

// types
import type { Item } from "../../items/types/item-types";
import type { Race } from "../../races/types/race-types";
import type { Skill } from "../../skills/types/skill-types";
import type { HeroFormEntry } from "../types/warband-types";

type SkillField = {
  key: string;
  label: string;
};

type HeroFormCardProps = {
  hero: HeroFormEntry;
  index: number;
  campaignId: number;
  statFields: readonly string[];
  skillFields: readonly SkillField[];
  availableRaces: Race[];
  availableItems: Item[];
  availableSkills: Skill[];
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onRemove: (index: number) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  onRaceCreated: (race: Race) => void;
};

export default function HeroFormCard({
  hero,
  index,
  campaignId,
  statFields,
  skillFields,
  availableRaces,
  availableItems,
  availableSkills,
  onUpdate,
  onRemove,
  onItemCreated,
  onSkillCreated,
  onRaceCreated,
}: HeroFormCardProps) {
  const inputClassName =
    "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50";
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "skills">("items");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [raceQuery, setRaceQuery] = useState(hero.race_name ?? "");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "items") {
      setIsSkillDialogOpen(false);
    } else {
      setIsItemDialogOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setRaceQuery(hero.race_name ?? "");
  }, [hero.race_name]);

  const matchingItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    const selectedIds = new Set(hero.items.map((item) => item.id));
    return availableItems
      .filter((item) => !selectedIds.has(item.id))
      .filter((item) => (query ? item.name.toLowerCase().includes(query) : true));
  }, [availableItems, hero.items, itemQuery]);
  const isItemLimitReached = hero.items.length >= 6;

  const handleAddItem = (item: Item) => {
    if (isItemLimitReached) {
      return;
    }
    onUpdate(index, (current) => ({
      ...current,
      items: [...current.items, item],
    }));
    setItemQuery("");
    setIsAddingItem(false);
  };

  const handleRemoveItem = (itemId: number) => {
    onUpdate(index, (current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== itemId),
    }));
  };

  const matchingSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    const selectedIds = new Set(hero.skills.map((skill) => skill.id));
    return availableSkills
      .filter((skill) => !selectedIds.has(skill.id))
      .filter((skill) => (query ? skill.name.toLowerCase().includes(query) : true));
  }, [availableSkills, hero.skills, skillQuery]);
  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

  const matchingRaces = useMemo(() => {
    const query = raceQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }
    return availableRaces
      .filter((race) => race.id !== hero.race_id)
      .filter((race) => race.name.toLowerCase().includes(query));
  }, [availableRaces, hero.race_id, raceQuery]);

  const handleAddSkill = (skill: Skill) => {
    onUpdate(index, (current) => ({
      ...current,
      skills: [...current.skills, skill],
    }));
    setSkillQuery("");
    setIsAddingSkill(false);
  };

  const handleRemoveSkill = (skillId: number) => {
    onUpdate(index, (current) => ({
      ...current,
      skills: current.skills.filter((skill) => skill.id !== skillId),
    }));
  };

  const handleCreatedItem = (item: Item) => {
    onItemCreated(index, item);
    setItemQuery("");
  };

  const handleCreatedSkill = (skill: Skill) => {
    onSkillCreated(index, skill);
    setSkillQuery("");
  };
  return (
    <div className="space-y-4 overflow-visible rounded-2xl border border-border/60 bg-card/80 p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]">
      <CreateItemDialog
        campaignId={campaignId}
        onCreated={handleCreatedItem}
        open={isItemDialogOpen}
        onOpenChange={setIsItemDialogOpen}
        trigger={null}
      />
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
      <CreateSkillDialog
        campaignId={campaignId}
        onCreated={handleCreatedSkill}
        typeOptions={skillTypeOptions}
        open={isSkillDialogOpen}
        onOpenChange={setIsSkillDialogOpen}
        trigger={null}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Hero {index + 1}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onRemove(index)}
        >
          Remove
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Name</Label>
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
              <Label className="text-sm font-semibold text-foreground">Unit type</Label>
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
              <Label className="text-sm font-semibold text-foreground">Race</Label>
              <div className="relative">
                <ActionSearchInput
                  value={raceQuery}
                  onChange={(event) => {
                    const value = event.target.value;
                    setRaceQuery(value);
                    onUpdate(index, (current) => ({
                      ...current,
                      race_id: null,
                      race_name: "",
                    }));
                  }}
                  placeholder="Search races..."
                  inputClassName={inputClassName}
                  actionLabel="Create"
                  actionAriaLabel="Create race"
                  actionVariant="outline"
                  actionClassName="h-8 border-border/60 bg-background/70 text-foreground hover:border-primary/60"
                  onAction={() => setIsRaceDialogOpen(true)}
                />
                {matchingRaces.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-1 shadow-[0_12px_30px_rgba(5,20,24,0.35)]">
                    {matchingRaces.map((race) => (
                      <button
                        key={race.id}
                        type="button"
                        onClick={() => {
                          onUpdate(index, (current) => ({
                            ...current,
                            race_id: race.id,
                            race_name: race.name,
                          }));
                          setRaceQuery(race.name);
                        }}
                        className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground hover:border-primary/60"
                      >
                        <span className="font-semibold">{race.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
              Stats
            </p>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-10">
              {statFields.map((stat) => (
                <div key={stat} className="space-y-1 text-center">
                  <Label className="text-[9px] uppercase text-muted-foreground">{stat}</Label>
                  <Input
                    value={hero.stats[stat]}
                    onChange={(event) =>
                      onUpdate(index, (current) => ({
                        ...current,
                        stats: { ...current.stats, [stat]: event.target.value },
                      }))
                    }
                    placeholder="-"
                    className={`${inputClassName} h-7 px-1 text-xs text-center`}
                  />
                </div>
              ))}
              <div className="space-y-1 text-center">
                <Label className="text-[9px] uppercase text-muted-foreground">AS</Label>
                <Input
                  value={hero.armour_save}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      armour_save: event.target.value,
                    }))
                  }
                  placeholder="-"
                  className={`${inputClassName} h-7 px-1 text-xs text-center`}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
              Available skills
            </p>
            <div className="flex flex-wrap gap-3">
              {skillFields.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={hero.available_skills[field.key]}
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
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Experience</Label>
              <Input
                type="number"
                min={0}
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
              <Label className="text-sm font-semibold text-foreground">Hire cost</Label>
              <Input
                type="number"
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
        </div>

        <div className="space-y-3 overflow-visible rounded-xl border border-border/60 bg-background/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Loadout</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={activeTab === "items" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("items")}
              >
                Items
              </Button>
              <Button
                type="button"
                variant={activeTab === "skills" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("skills")}
              >
                Skills
              </Button>
            </div>
          </div>

          {activeTab === "items" ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Assigned items</p>
                <span className="text-xs text-muted-foreground">{hero.items.length}/6</span>
              </div>
              {hero.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items assigned yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {hero.items.map((item) => (
                    <div
                      key={item.id}
                      className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                            {item.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isAddingItem ? (
                <div className="space-y-2">
                  <div className="relative">
                    <ActionSearchInput
                      value={itemQuery}
                      onChange={(event) => setItemQuery(event.target.value)}
                      placeholder="Search items..."
                      inputClassName={inputClassName}
                      actionLabel="Create"
                      actionAriaLabel="Create item"
                      actionVariant="outline"
                      actionClassName="h-8 border-border/60 bg-background/70 text-foreground hover:border-primary/60"
                      onAction={() => setIsItemDialogOpen(true)}
                    />
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-1 shadow-[0_12px_30px_rgba(5,20,24,0.35)]">
                      {matchingItems.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No matches yet.
                        </p>
                      ) : (
                        matchingItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleAddItem(item)}
                            className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground hover:border-primary/60"
                          >
                            <span className="font-semibold">{item.name}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                              {item.type}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setIsAddingItem(false);
                      setItemQuery("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddingItem(true)}
                  disabled={isItemLimitReached}
                >
                  + Add item
                </Button>
              )}
              {isItemLimitReached ? (
                <p className="text-xs text-accent/80">Item limit reached.</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Assigned skills</p>
                <span className="text-xs text-muted-foreground">{hero.skills.length}</span>
              </div>
              {hero.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills assigned yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {hero.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{skill.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                            {skill.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                          onClick={() => handleRemoveSkill(skill.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isAddingSkill ? (
                <div className="space-y-2">
                  <div className="relative">
                    <ActionSearchInput
                      value={skillQuery}
                      onChange={(event) => setSkillQuery(event.target.value)}
                      placeholder="Search skills..."
                      inputClassName={inputClassName}
                      actionLabel="Create"
                      actionAriaLabel="Create skill"
                      actionVariant="outline"
                      actionClassName="h-8 border-border/60 bg-background/70 text-foreground hover:border-primary/60"
                      onAction={() => setIsSkillDialogOpen(true)}
                    />
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-background/95 p-1 shadow-[0_12px_30px_rgba(5,20,24,0.35)]">
                      {matchingSkills.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          No matches yet.
                        </p>
                      ) : (
                        matchingSkills.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => handleAddSkill(skill)}
                            className="flex w-full items-center justify-between rounded-xl border border-transparent bg-background/60 px-3 py-2 text-left text-xs text-foreground hover:border-primary/60"
                          >
                            <span className="font-semibold">{skill.name}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                              {skill.type}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setIsAddingSkill(false);
                      setSkillQuery("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="secondary" onClick={() => setIsAddingSkill(true)}>
                  + Add skill
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

