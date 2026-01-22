import { useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { Item } from "../../items/types/item-types";
import type { Skill } from "../../skills/types/skill-types";
import type { HeroFormEntry } from "../types/warband-types";

type SkillField = {
  key: string;
  label: string;
};

type HeroFormCardProps = {
  hero: HeroFormEntry;
  index: number;
  statFields: readonly string[];
  skillFields: readonly SkillField[];
  availableItems: Item[];
  availableSkills: Skill[];
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onRemove: (index: number) => void;
};

export default function HeroFormCard({
  hero,
  index,
  statFields,
  skillFields,
  availableItems,
  availableSkills,
  onUpdate,
  onRemove,
}: HeroFormCardProps) {
  const inputClassName =
    "bg-slate-950/50 border-rose-300/40 text-slate-100 placeholder:text-slate-400 focus-visible:ring-rose-300/50";
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "skills">("items");

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
  return (
    <div className="space-y-3 rounded-xl border border-rose-500/50 bg-slate-950/80 p-3 text-slate-100 shadow-lg shadow-rose-900/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">
          Hero {index + 1}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="text-rose-100 hover:text-rose-50"
          onClick={() => onRemove(index)}
        >
          Remove
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-100">Name</Label>
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
              <Label className="text-sm font-semibold text-slate-100">Unit type</Label>
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
              <Label className="text-sm font-semibold text-slate-100">Race</Label>
              <Input
                value={hero.race}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    race: event.target.value,
                  }))
                }
                placeholder="Human, Skaven"
                className={inputClassName}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-rose-500/40 bg-slate-900/70 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">
              Stats
            </p>
            <div className="grid grid-cols-9 gap-1">
              {statFields.map((stat) => (
                <div key={stat} className="space-y-1 text-center">
                  <Label className="text-[9px] uppercase text-slate-200">{stat}</Label>
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
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-rose-500/40 bg-slate-900/70 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">
              Available skills
            </p>
            <div className="flex flex-wrap gap-3">
              {skillFields.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-xs text-slate-100">
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
              <Label className="text-sm font-semibold text-slate-100">Experience</Label>
              <Input
                value={hero.experience}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    experience: event.target.value,
                  }))
                }
                placeholder="0"
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-100">Hire cost</Label>
              <Input
                value={hero.hire_cost}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    hire_cost: event.target.value,
                  }))
                }
                placeholder="0"
                className={inputClassName}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-rose-500/40 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-200">Loadout</p>
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
                <p className="text-xs text-slate-300">Assigned items</p>
                <span className="text-xs text-slate-300">{hero.items.length}/6</span>
              </div>
              {hero.items.length === 0 ? (
                <p className="text-sm text-slate-300">No items assigned yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {hero.items.map((item) => (
                    <div
                      key={item.id}
                      className="group rounded-lg border border-rose-500/30 bg-slate-950/60 px-2 py-2 text-xs text-slate-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">
                            {item.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-rose-200/70 opacity-0 transition group-hover:opacity-100"
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
                  <Input
                    value={itemQuery}
                    onChange={(event) => setItemQuery(event.target.value)}
                    placeholder="Search items..."
                    className={inputClassName}
                  />
                  {matchingItems.length === 0 ? (
                    <p className="text-xs text-slate-300">No matches yet.</p>
                  ) : (
                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                      {matchingItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddItem(item)}
                          className="flex w-full items-center justify-between rounded-md border border-rose-500/30 bg-slate-950/60 px-2 py-2 text-left text-xs text-slate-100 hover:border-rose-400/60"
                        >
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-rose-200">
                            {item.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-300 hover:text-slate-100"
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
                <p className="text-xs text-rose-200/80">Item limit reached.</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300">Assigned skills</p>
                <span className="text-xs text-slate-300">{hero.skills.length}</span>
              </div>
              {hero.skills.length === 0 ? (
                <p className="text-sm text-slate-300">No skills assigned yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {hero.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="group rounded-lg border border-rose-500/30 bg-slate-950/60 px-2 py-2 text-xs text-slate-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{skill.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">
                            {skill.type}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-rose-200/70 opacity-0 transition group-hover:opacity-100"
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
                  <Input
                    value={skillQuery}
                    onChange={(event) => setSkillQuery(event.target.value)}
                    placeholder="Search skills..."
                    className={inputClassName}
                  />
                  {matchingSkills.length === 0 ? (
                    <p className="text-xs text-slate-300">No matches yet.</p>
                  ) : (
                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                      {matchingSkills.map((skill) => (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleAddSkill(skill)}
                          className="flex w-full items-center justify-between rounded-md border border-rose-500/30 bg-slate-950/60 px-2 py-2 text-left text-xs text-slate-100 hover:border-rose-400/60"
                        >
                          <span className="font-semibold">{skill.name}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-rose-200">
                            {skill.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-300 hover:text-slate-100"
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
