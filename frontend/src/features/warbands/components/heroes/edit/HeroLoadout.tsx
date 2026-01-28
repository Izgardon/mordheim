import { useEffect, useMemo, useState } from "react";
import { Button } from "@components/button";
import CreateItemDialog from "../../../../items/components/CreateItemDialog";
import CreateSkillDialog from "../../../../skills/components/CreateSkillDialog";
import SearchableDropdown from "./SearchableDropdown";
import type { Item } from "../../../../items/types/item-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HeroFormEntry } from "../../../types/warband-types";

type HeroLoadoutProps = {
  hero: HeroFormEntry;
  index: number;
  campaignId: number;
  availableItems: Item[];
  availableSkills: Skill[];
  inputClassName: string;
  canAddItems?: boolean;
  canAddSkills?: boolean;
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
  inputClassName,
  canAddItems = false,
  canAddSkills = false,
  onUpdate,
  onItemCreated,
  onSkillCreated,
}: HeroLoadoutProps) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"items" | "skills">("items");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);

  useEffect(() => {
    if (activeTab === "items") {
      setIsSkillDialogOpen(false);
    } else {
      setIsItemDialogOpen(false);
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

  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

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
            <div className="space-y-2">
              <SearchableDropdown
                query={itemQuery}
                onQueryChange={setItemQuery}
                placeholder="Search items..."
                inputClassName={inputClassName}
                items={matchingItems}
                isOpen={true}
                onSelectItem={handleAddItem}
                renderItem={(item) => (
                  <>
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                      {item.type}
                    </span>
                  </>
                )}
                getItemKey={(item) => item.id}
                canCreate={canAddItems}
                onCreateClick={() => setIsItemDialogOpen(true)}
                createLabel="Create"
              />
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
          {isItemLimitReached && <p className="text-xs text-accent/80">Item limit reached.</p>}
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
              <SearchableDropdown
                query={skillQuery}
                onQueryChange={setSkillQuery}
                placeholder="Search skills..."
                inputClassName={inputClassName}
                items={matchingSkills}
                isOpen={true}
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
  );
}
