import { useEffect, useMemo, useState } from "react";
import { Button } from "@components/button";
import { Tooltip } from "@components/tooltip";
import CreateItemDialog from "../../../../items/components/CreateItemDialog";
import CreateSkillDialog from "../../../../skills/components/CreateSkillDialog";
import CreateSpellDialog from "../../../../spells/components/CreateSpellDialog";
import CreateOtherDialog from "../../../../others/components/CreateOtherDialog";
import BuyItemDialog from "../../../../items/components/BuyItemDialog";
import SearchableDropdown from "./SearchableDropdown";
import type { Item } from "../../../../items/types/item-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { Other } from "../../../../others/types/other-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HeroFormEntry } from "../../../types/warband-types";

import buyIcon from "@/assets/components/buy.png";
import plusIcon from "@/assets/components/plus.png";
import plusIconHover from "@/assets/components/plus_hover.png";

type HeroLoadoutProps = {
  hero: HeroFormEntry;
  index: number;
  campaignId: number;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableOthers: Other[];
  inputClassName: string;
  canAddItems?: boolean;
  canAddSkills?: boolean;
  canAddSpells?: boolean;
  canAddOthers?: boolean;
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
};

export default function HeroLoadout({
  hero,
  index,
  campaignId,
  availableItems,
  availableSkills,
  availableSpells,
  availableOthers,
  inputClassName,
  canAddItems = false,
  canAddSkills = false,
  canAddSpells = false,
  canAddOthers = false,
  onUpdate,
  onItemCreated,
  onSkillCreated,
}: HeroLoadoutProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [isAddingSpell, setIsAddingSpell] = useState(false);
  const [spellQuery, setSpellQuery] = useState("");
  const [isAddingOther, setIsAddingOther] = useState(false);
  const [otherQuery, setOtherQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "skills" | "spells" | "other">(
    "items"
  );
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [isSpellDialogOpen, setIsSpellDialogOpen] = useState(false);
  const [isOtherDialogOpen, setIsOtherDialogOpen] = useState(false);
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
    if (activeTab !== "other") {
      setIsAddingOther(false);
      setOtherQuery("");
    }
  }, [activeTab]);

  const matchingItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return availableItems.filter((item) =>
      query ? item.name.toLowerCase().includes(query) : true
    );
  }, [availableItems, itemQuery]);

  const matchingSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    const selectedIds = new Set(hero.skills.map((skill) => skill.id));
    return availableSkills
      .filter((skill) => !selectedIds.has(skill.id))
      .filter((skill) => (query ? skill.name.toLowerCase().includes(query) : true));
  }, [availableSkills, hero.skills, skillQuery]);

  const matchingSpells = useMemo(() => {
    const query = spellQuery.trim().toLowerCase();
    const selectedIds = new Set(hero.spells.map((spell) => spell.id));
    return availableSpells
      .filter((spell) => !selectedIds.has(spell.id))
      .filter((spell) => (query ? spell.name.toLowerCase().includes(query) : true));
  }, [availableSpells, hero.spells, spellQuery]);

  const matchingOthers = useMemo(() => {
    const query = otherQuery.trim().toLowerCase();
    const selectedIds = new Set(hero.other.map((entry) => entry.id));
    return availableOthers
      .filter((entry) => !selectedIds.has(entry.id))
      .filter((entry) => (query ? entry.name.toLowerCase().includes(query) : true));
  }, [availableOthers, hero.other, otherQuery]);

  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

  const spellTypeOptions = useMemo(() => {
    const unique = new Set(availableSpells.map((spell) => spell.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSpells]);

  const otherTypeOptions = useMemo(() => {
    const unique = new Set(availableOthers.map((entry) => entry.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableOthers]);

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

  const handleRemoveItem = (itemIndex: number) => {
    onUpdate(index, (current) => ({
      ...current,
      items: current.items.filter((_, currentIndex) => currentIndex !== itemIndex),
    }));
  };

  const handleAddSkill = (skill: Skill) => {
    onUpdate(index, (current) => ({
      ...current,
      skills: [...current.skills, skill],
    }));
    setSkillQuery("");
    setIsAddingSkill(false);
  };

  const handleAddSpell = (spell: Spell) => {
    onUpdate(index, (current) => ({
      ...current,
      spells: [...current.spells, spell],
    }));
    setSpellQuery("");
    setIsAddingSpell(false);
  };

  const handleAddOther = (entry: Other) => {
    onUpdate(index, (current) => ({
      ...current,
      other: [...current.other, entry],
    }));
    setOtherQuery("");
    setIsAddingOther(false);
  };

  const handleRemoveSkill = (skillId: number) => {
    onUpdate(index, (current) => ({
      ...current,
      skills: current.skills.filter((skill) => skill.id !== skillId),
    }));
  };

  const handleRemoveSpell = (spellId: number) => {
    onUpdate(index, (current) => ({
      ...current,
      spells: current.spells.filter((spell) => spell.id !== spellId),
    }));
  };

  const handleRemoveOther = (otherId: number) => {
    onUpdate(index, (current) => ({
      ...current,
      other: current.other.filter((entry) => entry.id !== otherId),
    }));
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

  const handleCloseOtherSearch = () => {
    setIsAddingOther(false);
    setOtherQuery("");
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
    onUpdate(index, (current) => ({
      ...current,
      spells: [...current.spells, spell],
    }));
    setSpellQuery("");
  };

  const handleCreatedOther = (entry: Other) => {
    onUpdate(index, (current) => ({
      ...current,
      other: [...current.other, entry],
    }));
    setOtherQuery("");
  };

  return (
    <div className="space-y-3 overflow-visible rounded-xl border border-border/60 bg-background/60 p-3">
      {canAddItems && (
        <CreateItemDialog
          campaignId={campaignId}
          onCreated={handleCreatedItem}
          open={isItemDialogOpen}
          onOpenChange={setIsItemDialogOpen}
          trigger={null}
        />
      )}
      {canAddSkills && (
        <CreateSkillDialog
          campaignId={campaignId}
          onCreated={handleCreatedSkill}
          typeOptions={skillTypeOptions}
          open={isSkillDialogOpen}
          onOpenChange={setIsSkillDialogOpen}
          trigger={null}
        />
      )}
      {canAddSpells && (
        <CreateSpellDialog
          campaignId={campaignId}
          onCreated={handleCreatedSpell}
          typeOptions={spellTypeOptions}
          open={isSpellDialogOpen}
          onOpenChange={setIsSpellDialogOpen}
          trigger={null}
        />
      )}
      {canAddOthers && (
        <CreateOtherDialog
          campaignId={campaignId}
          onCreated={handleCreatedOther}
          typeOptions={otherTypeOptions}
          open={isOtherDialogOpen}
          onOpenChange={setIsOtherDialogOpen}
          trigger={null}
        />
      )}
      {buyItemTarget && (
        <BuyItemDialog
          item={buyItemTarget}
          open={buyItemDialogOpen}
          onOpenChange={setBuyItemDialogOpen}
          trigger={null}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Loadout</p>
        <div className="flex items-center gap-2">
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
          <Button
            type="button"
            variant={activeTab === "spells" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("spells")}
          >
            Spells
          </Button>
          <Button
            type="button"
            variant={activeTab === "other" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("other")}
          >
            Other
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
                      ✕
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
                onSelectItem={handleAddItem}
                renderItem={(item) => (
                  <span className="font-semibold">{item.name}</span>
                )}
                renderActions={(item) => (
                  <div className="flex items-center gap-3">
                    <Tooltip
                      trigger={
                        <button
                          type="button"
                          aria-label="Buy item"
                          className="h-8 w-8 shrink-0 transition-[filter] hover:brightness-125"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setBuyItemTarget(item);
                            setBuyItemDialogOpen(true);
                          }}
                        >
                          <img
                            src={buyIcon}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </button>
                      }
                      content="Buy Item"
                    />
                    <Tooltip
                      trigger={
                        <button
                          type="button"
                          aria-label="Add item"
                          className="group relative h-8 w-8 shrink-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleAddItem(item)}
                        >
                          <img
                            src={plusIcon}
                            alt=""
                            className="absolute inset-0 h-full w-full object-contain transition-opacity group-hover:opacity-0"
                          />
                          <img
                            src={plusIconHover}
                            alt=""
                            className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        </button>
                      }
                      content="Add Item"
                    />
                  </div>
                )}
                getItemKey={(item) => item.id}
                canCreate={canAddItems}
                onCreateClick={() => setIsItemDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => setIsAddingItem(true)}
              disabled={isItemLimitReached}
            >
              + Add item
            </Button>
          )}
          {isItemLimitReached && <p className="text-xs text-accent/80">Item limit reached.</p>}
        </>
      ) : activeTab === "skills" ? (
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
                canCreate={canAddSkills}
                onCreateClick={() => setIsSkillDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button type="button" onClick={() => setIsAddingSkill(true)}>
              + Add skill
            </Button>
          )}
        </>
      ) : activeTab === "spells" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned spells</p>
            <span className="text-xs text-muted-foreground">{hero.spells.length}</span>
          </div>
          {hero.spells.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spells assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {hero.spells.map((spell) => (
                <div
                  key={spell.id}
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
                    <button
                      type="button"
                      className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                      onClick={() => handleRemoveSpell(spell.id)}
                    >
                      âœ•
                    </button>
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
                canCreate={canAddSpells}
                onCreateClick={() => setIsSpellDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button type="button" onClick={() => setIsAddingSpell(true)}>
              + Add spell
            </Button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned others</p>
            <span className="text-xs text-muted-foreground">{hero.other.length}</span>
          </div>
          {hero.other.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {hero.other.map((entry) => (
                <div
                  key={entry.id}
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
                    <button
                      type="button"
                      className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                      onClick={() => handleRemoveOther(entry.id)}
                    >
                      âœ•
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isAddingOther ? (
            <div className="relative">
              <SearchableDropdown
                query={otherQuery}
                onQueryChange={setOtherQuery}
                placeholder="Search other..."
                inputClassName={`${inputClassName} h-12`}
                items={matchingOthers}
                isOpen={true}
                onBlur={handleCloseOtherSearch}
                onSelectItem={handleAddOther}
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
                canCreate={canAddOthers}
                onCreateClick={() => setIsOtherDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          ) : (
            <Button type="button" onClick={() => setIsAddingOther(true)}>
              + Add other
            </Button>
          )}
        </>
      )}
    </div>
  );
}
