import { useEffect, useMemo, useState } from "react";
import { Button } from "@components/button";
import ItemFormDialog from "../../../../items/components/ItemFormDialog";
import SkillFormDialog from "../../../../skills/components/SkillFormDialog";
import CreateSpellDialog from "../../../../spells/components/CreateSpellDialog";
import CreateSpecialDialog from "../../../../special/components/CreateSpecialDialog";
import AcquireItemDialog from "../../../../items/components/AcquireItemDialog";
import SearchableDropdown from "./SearchableDropdown";
import type { Item } from "../../../../items/types/item-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { Special } from "../../../../special/types/special-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HeroFormEntry } from "../../../types/warband-types";
import { isPendingByType } from "../utils/pending-entries";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isTraitSpecial = (name?: string | null, caster?: string) => {
  if (typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  if (n === "large") return true;
  if (n === "wizard" && caster === "Wizard") return true;
  if (n === "priest" && caster === "Priest") return true;
  return false;
};


type HeroLoadoutProps = {
  hero: HeroFormEntry;
  index: number;
  campaignId: number;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  inputClassName: string;
  canAddCustom?: boolean;
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  initialTab?: "items" | "skills" | "spells" | "special";
};

export default function HeroLoadout({
  hero,
  index,
  campaignId,
  availableItems,
  availableSkills,
  availableSpells,
  availableSpecials,
  inputClassName,
  canAddCustom = false,
  onUpdate,
  onItemCreated,
  onSkillCreated,
  initialTab,
}: HeroLoadoutProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [isAddingSpell, setIsAddingSpell] = useState(false);
  const [spellQuery, setSpellQuery] = useState("");
  const [isAddingSpecial, setIsAddingSpecial] = useState(false);
  const [specialQuery, setSpecialQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "skills" | "spells" | "special">(
    initialTab ?? "items"
  );
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [isSpellDialogOpen, setIsSpellDialogOpen] = useState(false);
  const [isSpecialDialogOpen, setIsSpecialDialogOpen] = useState(false);
  const [buyItemDialogOpen, setBuyItemDialogOpen] = useState(false);
  const [buyItemTarget, setBuyItemTarget] = useState<Item | null>(null);

  useEffect(() => {
    if (activeTab !== "items") {
      setIsItemDialogOpen(false);
      setIsAddingItem(false);
      setItemQuery("");
    }
    if (activeTab !== "skills") {
      setIsSkillDialogOpen(false);
      setIsAddingSkill(false);
      setSkillQuery("");
    }
    if (activeTab !== "spells") {
      setIsAddingSpell(false);
      setSpellQuery("");
    }
    if (activeTab !== "special") {
      setIsAddingSpecial(false);
      setSpecialQuery("");
    }
  }, [activeTab]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const isCaster = Boolean(hero.caster && hero.caster !== "No");

  useEffect(() => {
    if (!isCaster && activeTab === "spells") {
      setActiveTab("items");
    }
  }, [isCaster, activeTab]);

  const matchingItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return availableItems.filter((item) =>
      query ? item.name.toLowerCase().includes(query) : true
    );
  }, [availableItems, itemQuery]);

  const matchingSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    return availableSkills
      .filter((skill) => (query ? skill.name.toLowerCase().includes(query) : true));
  }, [availableSkills, skillQuery]);

  const matchingSpells = useMemo(() => {
    const query = spellQuery.trim().toLowerCase();
    return availableSpells
      .filter((spell) => (query ? spell.name.toLowerCase().includes(query) : true));
  }, [availableSpells, spellQuery]);

  const matchingSpecials = useMemo(() => {
    const query = specialQuery.trim().toLowerCase();
    return availableSpecials.filter((entry) =>
      query ? entry.name.toLowerCase().includes(query) : true
    );
  }, [availableSpecials, specialQuery]);

  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

  const spellTypeOptions = useMemo(() => {
    const unique = new Set(availableSpells.map((spell) => spell.type).filter(isNonEmptyString));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSpells]);

  const specialTypeOptions = useMemo(() => {
    const unique = new Set(availableSpecials.map((entry) => entry.type).filter(isNonEmptyString));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSpecials]);

  const visibleSkills = useMemo(() => hero.skills.filter((s) => !isPendingByType(s)), [hero.skills]);
  const visibleSpells = useMemo(() => hero.spells.filter((s) => !isPendingByType(s)), [hero.spells]);
  const visibleSpecials = useMemo(() => hero.specials.filter((f) => !isPendingByType(f)), [hero.specials]);

  const handleAddItem = (item: Item) => {
    onUpdate(index, (current) => ({
      ...current,
      items: [...current.items, item],
    }));
  };

  const handleSelectItem = (item: Item) => {
    if (!hero.id) {
      handleAddItem(item);
      setIsAddingItem(false);
      setItemQuery("");
      return;
    }
    setBuyItemTarget(item);
    setBuyItemDialogOpen(true);
    setIsAddingItem(false);
    setItemQuery("");
  };

  const handleRemoveItem = (itemIndex: number) => {
    onUpdate(index, (current) => ({
      ...current,
      items: current.items.filter((_, currentIndex) => currentIndex !== itemIndex),
    }));
  };

  const handleAddSkill = (skill: Skill) => {
    onUpdate(index, (current) => {
      const pendingIdx = current.skills.findIndex((s) => isPendingByType(s));
      const cleaned = pendingIdx !== -1 ? current.skills.filter((_, i) => i !== pendingIdx) : current.skills;
      return { ...current, skills: [...cleaned, skill] };
    });
    setSkillQuery("");
    setIsAddingSkill(false);
  };

  const handleAddSpell = (spell: Spell) => {
    onUpdate(index, (current) => {
      const pendingIdx = current.spells.findIndex((s) => isPendingByType(s));
      const cleaned = pendingIdx !== -1 ? current.spells.filter((_, i) => i !== pendingIdx) : current.spells;
      return { ...current, spells: [...cleaned, spell] };
    });
    setSpellQuery("");
    setIsAddingSpell(false);
  };

  const handleAddSpecial = (entry: Special) => {
    onUpdate(index, (current) => {
      const pendingIdx = current.specials.findIndex((f) => isPendingByType(f));
      const cleaned = pendingIdx !== -1 ? current.specials.filter((_, i) => i !== pendingIdx) : current.specials;
      const updated: Partial<HeroFormEntry> = {};
      const n = entry.name.trim().toLowerCase();
      if (n === "large") updated.large = true;
      if (n === "wizard") updated.caster = "Wizard";
      if (n === "priest") updated.caster = "Priest";
      return { ...current, ...updated, specials: [...cleaned, entry] };
    });
    setSpecialQuery("");
    setIsAddingSpecial(false);
  };

  const handleRemoveSkill = (skillIndex: number) => {
    onUpdate(index, (current) => ({
      ...current,
      skills: current.skills.filter((_, currentIndex) => currentIndex !== skillIndex),
    }));
  };

  const handleRemoveSpell = (spellIndex: number) => {
    onUpdate(index, (current) => ({
      ...current,
      spells: current.spells.filter((_, currentIndex) => currentIndex !== spellIndex),
    }));
  };

  const handleRemoveSpecial = (specialIndex: number) => {
    onUpdate(index, (current) => {
      const removed = current.specials[specialIndex];
      const updated: Partial<HeroFormEntry> = {};
      if (removed) {
        const n = removed.name.trim().toLowerCase();
        if (n === "large") updated.large = false;
        if (n === "wizard" && current.caster === "Wizard") updated.caster = "No";
        if (n === "priest" && current.caster === "Priest") updated.caster = "No";
      }
      return {
        ...current,
        ...updated,
        specials: current.specials.filter((_, currentIndex) => currentIndex !== specialIndex),
      };
    });
  };

  const handleCloseItemSearch = () => {
    setIsAddingItem(false);
    setItemQuery("");
  };

  const handleCloseSkillSearch = () => {
    setIsAddingSkill(false);
    setSkillQuery("");
  };

  const handleCloseSpellSearch = () => {
    setIsAddingSpell(false);
    setSpellQuery("");
  };

  const handleCloseSpecialSearch = () => {
    setIsAddingSpecial(false);
    setSpecialQuery("");
  };

  const handleCreatedItem = (item: Item) => {
    onItemCreated(index, item);
    setItemQuery("");
  };

  const handleCreatedSkill = (skill: Skill) => {
    onSkillCreated(index, skill);
    setSkillQuery("");
  };

  const handleCreatedSpell = (spell: Spell) => {
    onUpdate(index, (current) => {
      const pendingIdx = current.spells.findIndex((s) => isPendingByType(s));
      const cleaned = pendingIdx !== -1 ? current.spells.filter((_, i) => i !== pendingIdx) : current.spells;
      return { ...current, spells: [...cleaned, spell] };
    });
    setSpellQuery("");
  };

  const handleCreatedSpecial = (entry: Special) => {
    onUpdate(index, (current) => {
      const pendingIdx = current.specials.findIndex((f) => isPendingByType(f));
      const cleaned = pendingIdx !== -1 ? current.specials.filter((_, i) => i !== pendingIdx) : current.specials;
      const updated: Partial<HeroFormEntry> = {};
      const n = entry.name.trim().toLowerCase();
      if (n === "large") updated.large = true;
      if (n === "wizard") updated.caster = "Wizard";
      if (n === "priest") updated.caster = "Priest";
      return { ...current, ...updated, specials: [...cleaned, entry] };
    });
    setSpecialQuery("");
  };

  return (
    <div className="space-y-3 overflow-visible rounded-xl border border-border/60 bg-background/60 p-3">
      {canAddCustom && (
        <ItemFormDialog
          mode="create"
          campaignId={campaignId}
          onCreated={handleCreatedItem}
          open={isItemDialogOpen}
          onOpenChange={setIsItemDialogOpen}
          trigger={null}
        />
      )}
      {canAddCustom && (
        <SkillFormDialog
          mode="create"
          campaignId={campaignId}
          onCreated={handleCreatedSkill}
          typeOptions={skillTypeOptions}
          open={isSkillDialogOpen}
          onOpenChange={setIsSkillDialogOpen}
          trigger={null}
        />
      )}
      {canAddCustom && (
        <CreateSpellDialog
          campaignId={campaignId}
          onCreated={handleCreatedSpell}
          typeOptions={spellTypeOptions}
          open={isSpellDialogOpen}
          onOpenChange={setIsSpellDialogOpen}
          trigger={null}
        />
      )}
      {canAddCustom && (
        <CreateSpecialDialog
          campaignId={campaignId}
          onCreated={handleCreatedSpecial}
          typeOptions={specialTypeOptions}
          open={isSpecialDialogOpen}
          onOpenChange={setIsSpecialDialogOpen}
          trigger={null}
        />
      )}
      {buyItemTarget && (
        <AcquireItemDialog
          item={buyItemTarget}
          open={buyItemDialogOpen}
          onOpenChange={setBuyItemDialogOpen}
          trigger={null}
          presetUnitType={hero.id ? "heroes" : undefined}
          presetUnitId={hero.id}
          disableUnitSelection={Boolean(hero.id)}
          defaultUnitSectionCollapsed={Boolean(hero.id)}
          defaultRaritySectionCollapsed={false}
          defaultPriceSectionCollapsed={false}
          onAcquire={(item, unitType, unitId) => {
            if (unitType === "heroes" && String(hero.id ?? "") === unitId) {
              handleAddItem(item);
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Loadout</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "items" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("items")}
          >
            Items
          </Button>
          <Button
            type="button"
            variant={activeTab === "skills" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("skills")}
          >
            Skills
          </Button>
          {isCaster && (
            <Button
              type="button"
              variant={activeTab === "spells" ? "default" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("spells")}
            >
              Spells
            </Button>
          )}
          <Button
            type="button"
            variant={activeTab === "special" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("special")}
          >
            Special
          </Button>
        </div>
      </div>

      {activeTab === "items" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned items</p>
            <span className="text-xs text-muted-foreground">{hero.items.length}</span>
          </div>
          {hero.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items assigned yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {hero.items.map((item, itemIndex) => (
                <div
                  key={`${item.id}-${itemIndex}`}
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
                      onClick={() => handleRemoveItem(itemIndex)}
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingItem ? (
            <div className="relative">
              <SearchableDropdown
                query={itemQuery}
                onQueryChange={setItemQuery}
                placeholder="Search items..."
                inputClassName={`${inputClassName} h-12`}
                items={matchingItems}
                isOpen={true}
                onBlur={handleCloseItemSearch}
                onSelectItem={handleSelectItem}
                renderItem={(item) => (
                  <>
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                      {item.type}
                    </span>
                  </>
                )}
                getItemKey={(item) => item.id}
                canCreate={canAddCustom}
                onCreateClick={() => setIsItemDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsAddingItem(true)}
            >
              + Add item
            </Button>
          )}
        </>
      ) : activeTab === "skills" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned skills</p>
            <span className="text-xs text-muted-foreground">{visibleSkills.length}</span>
          </div>
          {visibleSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleSkills.map((skill, skillIndex) => (
                <div
                  key={`${skill.id}-${skillIndex}`}
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
                      onClick={() => handleRemoveSkill(skillIndex)}
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingSkill ? (
            <div className="relative">
              <SearchableDropdown
                query={skillQuery}
                onQueryChange={setSkillQuery}
                placeholder="Search skills..."
                inputClassName={`${inputClassName} h-12`}
                items={matchingSkills}
                isOpen={true}
                onBlur={handleCloseSkillSearch}
                onSelectItem={handleAddSkill}
                renderItem={(skill) => (
                  <>
                    <span className="font-semibold">{skill.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                      {skill.type}
                    </span>
                  </>
                )}
                getItemKey={(skill) => skill.id}
                canCreate={canAddCustom}
                onCreateClick={() => setIsSkillDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button type="button" size="sm" onClick={() => setIsAddingSkill(true)}>
              + Add skill
            </Button>
          )}
        </>
      ) : activeTab === "spells" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned spells</p>
            <span className="text-xs text-muted-foreground">{visibleSpells.length}</span>
          </div>
          {visibleSpells.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spells assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleSpells.map((spell, spellIndex) => (
                <div
                  key={`${spell.id}-${spellIndex}`}
                  className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{spell.name}</p>
                      {spell.type ? (
                        <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                          {spell.type}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {spell.dc !== undefined && spell.dc !== null && spell.dc !== "" ? (
                        <span className="whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                          DC {spell.dc}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                        onClick={() => handleRemoveSpell(spellIndex)}
                      >
                        x
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingSpell ? (
            <div className="relative">
              <SearchableDropdown
                query={spellQuery}
                onQueryChange={setSpellQuery}
                placeholder="Search spells..."
                inputClassName={`${inputClassName} h-12`}
                items={matchingSpells}
                isOpen={true}
                onBlur={handleCloseSpellSearch}
                onSelectItem={handleAddSpell}
                renderItem={(spell) => (
                  <>
                    <span className="font-semibold">{spell.name}</span>
                    {spell.type ? (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                        {spell.type}
                      </span>
                    ) : null}
                  </>
                )}
                getItemKey={(spell) => spell.id}
                canCreate={canAddCustom}
                onCreateClick={() => setIsSpellDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button type="button" size="sm" onClick={() => setIsAddingSpell(true)}>
              + Add spell
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned specials</p>
            <span className="text-xs text-muted-foreground">{visibleSpecials.length}</span>
          </div>
          {visibleSpecials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visibleSpecials.map((entry, specialIndex) => (
                <div
                  key={`${entry.id}-${specialIndex}`}
                  className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{entry.name}</p>
                      {entry.type ? (
                        <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                          {entry.type}
                        </p>
                      ) : null}
                    </div>
                    {isTraitSpecial(entry.name, hero.caster) ? null : (
                      <button
                        type="button"
                        className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                        onClick={() => handleRemoveSpecial(specialIndex)}
                      >
                        x
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingSpecial ? (
            <div className="relative">
              <SearchableDropdown
                query={specialQuery}
                onQueryChange={setSpecialQuery}
                placeholder="Search specials..."
                inputClassName={`${inputClassName} h-12`}
                items={matchingSpecials}
                isOpen={true}
                onBlur={handleCloseSpecialSearch}
                onSelectItem={handleAddSpecial}
                renderItem={(entry) => (
                  <>
                    <span className="font-semibold">{entry.name}</span>
                    {entry.type ? (
                      <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                        {entry.type}
                      </span>
                    ) : null}
                  </>
                )}
                getItemKey={(entry) => entry.id}
                canCreate={canAddCustom}
                onCreateClick={() => setIsSpecialDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button type="button" size="sm" onClick={() => setIsAddingSpecial(true)}>
              + Add special
            </Button>
          )}
        </>
      )}
    </div>
  );
}


