import { useEffect, useMemo, useRef, useState } from "react";
import type { Item } from "@/features/items/types/item-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { Special } from "@/features/special/types/special-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { HeroFormEntry } from "../../types/warband-types";
import { isPendingByType } from "../../components/heroes/utils/pending-entries";
import type { UnitTypeOption } from "@/components/ui/unit-selection-section";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isTraitSpecial = (name?: string | null, caster?: string) => {
  if (typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  if (n === "large") return true;
  if (n === "wizard" && caster === "Wizard") return true;
  if (n === "priest" && caster === "Priest") return true;
  return false;
};

export type UseUnitLoadoutProps = {
  unit: HeroFormEntry;
  index: number;
  campaignId: number;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  canAddCustom?: boolean;
  unitType?: UnitTypeOption;
  deferItemCommit?: boolean;
  reservedGold?: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  onPendingPurchaseRemove?: (match: { unitType: UnitTypeOption; unitId: string; itemId: number }) => void;
  onUpdate: (index: number, updater: (unit: HeroFormEntry) => HeroFormEntry) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  initialTab?: "items" | "skills" | "spells" | "special";
};

export function useUnitLoadout({
  unit,
  index,
  availableItems,
  availableSkills,
  availableSpells,
  availableSpecials,
  unitType,
  deferItemCommit = false,
  onPendingPurchaseAdd,
  onPendingPurchaseRemove,
  onUpdate,
  onItemCreated,
  onSkillCreated,
  initialTab,
}: UseUnitLoadoutProps) {
  // Search state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [isAddingSpell, setIsAddingSpell] = useState(false);
  const [spellQuery, setSpellQuery] = useState("");
  const [isAddingSpecial, setIsAddingSpecial] = useState(false);
  const [specialQuery, setSpecialQuery] = useState("");

  // Tab state
  const [activeTab, setActiveTab] = useState<"items" | "skills" | "spells" | "special">(
    initialTab ?? "items"
  );

  // Dialog open states
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [isSpellDialogOpen, setIsSpellDialogOpen] = useState(false);
  const [isSpecialDialogOpen, setIsSpecialDialogOpen] = useState(false);
  const [buyItemDialogOpen, setBuyItemDialogOpen] = useState(false);
  const [buyItemTarget, setBuyItemTarget] = useState<Item | null>(null);

  // draftUnitId generation
  const draftUnitIdRef = useRef<string | null>(null);
  if (!draftUnitIdRef.current) {
    const unitKey = unitType ?? "unit";
    draftUnitIdRef.current = `draft-${unitKey}-${Date.now()}-${index}`;
  }
  const draftUnitId = draftUnitIdRef.current;

  // Tab reset logic - switching tabs clears search state
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

  // isCaster derivation
  const isCaster = Boolean(unit.caster && unit.caster !== "No");

  useEffect(() => {
    if (!isCaster && activeTab === "spells") {
      setActiveTab("items");
    }
  }, [isCaster, activeTab]);

  // Filtered item/skill/spell/special lists
  const matchingItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return availableItems.filter((item) =>
      query ? item.name.toLowerCase().includes(query) : true
    );
  }, [availableItems, itemQuery]);

  const matchingSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    return availableSkills.filter((skill) =>
      query ? skill.name.toLowerCase().includes(query) : true
    );
  }, [availableSkills, skillQuery]);

  const matchingSpells = useMemo(() => {
    const query = spellQuery.trim().toLowerCase();
    return availableSpells.filter((spell) =>
      query ? spell.name.toLowerCase().includes(query) : true
    );
  }, [availableSpells, spellQuery]);

  const matchingSpecials = useMemo(() => {
    const query = specialQuery.trim().toLowerCase();
    return availableSpecials.filter((entry) =>
      query ? entry.name.toLowerCase().includes(query) : true
    );
  }, [availableSpecials, specialQuery]);

  // Type option dedup
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

  // Visible lists filtering pending entries
  const visibleSkills = useMemo(() => unit.skills.filter((s) => !isPendingByType(s)), [unit.skills]);
  const visibleSpells = useMemo(() => unit.spells.filter((s) => !isPendingByType(s)), [unit.spells]);
  const visibleSpecials = useMemo(() => unit.specials.filter((f) => !isPendingByType(f)), [unit.specials]);

  // Add/remove handlers
  const handleAddItem = (item: Item) => {
    onUpdate(index, (current) => ({
      ...current,
      items: [...current.items, item],
    }));
  };

  const handleSelectItem = (item: Item) => {
    setBuyItemTarget(item);
    setBuyItemDialogOpen(true);
    setIsAddingItem(false);
    setItemQuery("");
  };

  const handleRemoveItem = (itemIndex: number) => {
    const removed = unit.items[itemIndex];
    onUpdate(index, (current) => ({
      ...current,
      items: current.items.filter((_, currentIndex) => currentIndex !== itemIndex),
    }));
    if (deferItemCommit && removed && unitType && unit.id && onPendingPurchaseRemove) {
      onPendingPurchaseRemove({ unitType, unitId: String(unit.id), itemId: removed.id });
    }
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

  const handleRemoveSkill = (skillIndex: number) => {
    onUpdate(index, (current) => ({
      ...current,
      skills: current.skills.filter((_, currentIndex) => currentIndex !== skillIndex),
    }));
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

  const handleRemoveSpell = (spellIndex: number) => {
    onUpdate(index, (current) => ({
      ...current,
      spells: current.spells.filter((_, currentIndex) => currentIndex !== spellIndex),
    }));
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

  // Close handlers
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

  // handleCreated* callbacks
  const handleCreatedItem = (item: Item) => {
    onItemCreated(index, item);
    setItemQuery("");
    setIsAddingItem(false);
    setBuyItemTarget(item);
    setBuyItemDialogOpen(true);
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

  return {
    // Tab state
    activeTab,
    setActiveTab,

    // Search state - items
    isAddingItem,
    setIsAddingItem,
    itemQuery,
    setItemQuery,
    handleCloseItemSearch,

    // Search state - skills
    isAddingSkill,
    setIsAddingSkill,
    skillQuery,
    setSkillQuery,
    handleCloseSkillSearch,

    // Search state - spells
    isAddingSpell,
    setIsAddingSpell,
    spellQuery,
    setSpellQuery,
    handleCloseSpellSearch,

    // Search state - specials
    isAddingSpecial,
    setIsAddingSpecial,
    specialQuery,
    setSpecialQuery,
    handleCloseSpecialSearch,

    // Dialog open states
    isItemDialogOpen,
    setIsItemDialogOpen,
    isSkillDialogOpen,
    setIsSkillDialogOpen,
    isSpellDialogOpen,
    setIsSpellDialogOpen,
    isSpecialDialogOpen,
    setIsSpecialDialogOpen,
    buyItemDialogOpen,
    setBuyItemDialogOpen,
    buyItemTarget,
    setBuyItemTarget,

    // draftUnitId
    draftUnitId,

    // isCaster
    isCaster,

    // Filtered lists
    matchingItems,
    matchingSkills,
    matchingSpells,
    matchingSpecials,

    // Type options
    skillTypeOptions,
    spellTypeOptions,
    specialTypeOptions,

    // Visible lists (pending filtered)
    visibleSkills,
    visibleSpells,
    visibleSpecials,

    // Item handlers
    handleAddItem,
    handleSelectItem,
    handleRemoveItem,

    // Skill handlers
    handleAddSkill,
    handleRemoveSkill,

    // Spell handlers
    handleAddSpell,
    handleRemoveSpell,

    // Special handlers
    handleAddSpecial,
    handleRemoveSpecial,

    // Created callbacks
    handleCreatedItem,
    handleCreatedSkill,
    handleCreatedSpell,
    handleCreatedSpecial,
  };
}
