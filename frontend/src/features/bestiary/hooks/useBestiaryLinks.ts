import { useCallback, useState } from "react";

import { createSpecial } from "@/features/special/api/special-api";
import { useCampaignItems } from "@/features/warbands/hooks/campaign/useCampaignItems";
import { useCampaignSkills } from "@/features/warbands/hooks/campaign/useCampaignSkills";
import { useCampaignSpecial } from "@/features/warbands/hooks/campaign/useCampaignSpecial";
import { useCampaignSpells } from "@/features/warbands/hooks/campaign/useCampaignSpells";
import { useCatalogueCache } from "@/lib/catalogue-queries";
import { getRefusalMessage } from "@/lib/get-error-message";

import type { Item } from "@/features/items/types/item-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

export type SelectedItem = Item & { quantity: number };

/** What an edited entry already links to (a hired sword's or dramatis persona's detail). */
export type LinkedEntry = {
  skills: Skill[];
  specials: Special[];
  spells: Spell[];
  equipment: { item: Item; quantity: number }[];
};

/** Adds `entry` unless it is already chosen. */
const addOnce =
  <T extends { id: number }>(entry: T) =>
  (prev: T[]) =>
    prev.some((chosen) => chosen.id === entry.id) ? prev : [...prev, entry];

type UseBestiaryLinksOptions = {
  campaignId: number;
  /** The pickers read the campaign's cached lists only while the dialog is open. */
  open: boolean;
  /** The type a special created on the spot takes: "Animal", "Hired Sword", "Dramatis Persona". */
  specialType: string;
  /** The most of one item the equipment may carry (a hireling's kit: 20). */
  maxQuantity?: number;
};

/**
 * What a bestiary entry links to: its special rules (one can be created on the spot), skills,
 * spells and equipment with quantities, picked from the campaign's cached lists.
 */
export function useBestiaryLinks({
  campaignId,
  open,
  specialType,
  maxQuantity = 99,
}: UseBestiaryLinksOptions) {
  const [specials, setSpecials] = useState<Special[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [spells, setSpells] = useState<Spell[]>([]);
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [isCreatingSpecial, setIsCreatingSpecial] = useState(false);
  const [newSpecialName, setNewSpecialName] = useState("");
  const [newSpecialDescription, setNewSpecialDescription] = useState("");
  const [isSavingSpecial, setIsSavingSpecial] = useState(false);
  /** Why the special created on the spot was refused (the form stays open to retry). */
  const [specialError, setSpecialError] = useState("");
  const catalogueCache = useCatalogueCache();
  const hasCampaignId = !Number.isNaN(campaignId);
  const lookup = { campaignId, hasCampaignId, enabled: open && hasCampaignId };
  const { availableSpecials } = useCampaignSpecial(lookup);
  const { availableSkills } = useCampaignSkills(lookup);
  const { availableSpells } = useCampaignSpells(lookup);
  const { availableItems } = useCampaignItems(lookup);

  const addSpecial = useCallback((special: Special) => setSpecials(addOnce(special)), []);
  const addSkill = useCallback((skill: Skill) => setSkills(addOnce(skill)), []);
  const addSpell = useCallback((spell: Spell) => setSpells(addOnce(spell)), []);
  const addItem = useCallback(
    (item: Item) => setItems(addOnce<SelectedItem>({ ...item, quantity: 1 })),
    []
  );

  const closeNewSpecial = useCallback(() => {
    setIsCreatingSpecial(false);
    setNewSpecialName("");
    setNewSpecialDescription("");
    setSpecialError("");
  }, []);

  /** An edited entry's links (none for a blank form), with no special being created. */
  const load = useCallback(
    (entry: LinkedEntry | null) => {
      setSpecials(entry?.specials ?? []);
      setSkills(entry?.skills ?? []);
      setSpells(entry?.spells ?? []);
      setItems(
        entry?.equipment.map(({ item, quantity }) => ({ ...item, quantity: quantity || 1 })) ?? []
      );
      closeNewSpecial();
    },
    [closeNewSpecial]
  );

  const createNewSpecial = async () => {
    const name = newSpecialName.trim();
    if (!name) return;
    setIsSavingSpecial(true);
    setSpecialError("");
    try {
      const created = await createSpecial({
        campaign_id: campaignId,
        name,
        type: specialType,
        description: newSpecialDescription.trim(),
      });
      catalogueCache.upsert("specials", campaignId, created);
      setSpecials((prev) => [...prev, created]);
      closeNewSpecial();
    } catch (caught) {
      // The form stays open so the rule can be fixed and tried again.
      setSpecialError(getRefusalMessage(caught, "Unable to add the rule."));
    } finally {
      setIsSavingSpecial(false);
    }
  };

  return {
    available: {
      specials: availableSpecials,
      skills: availableSkills,
      spells: availableSpells,
      items: availableItems,
    },
    specials,
    skills,
    spells,
    items,
    addSpecial,
    addSkill,
    addSpell,
    addItem,
    removeSpecial: (id: number) => setSpecials((prev) => prev.filter((s) => s.id !== id)),
    removeSkill: (id: number) => setSkills((prev) => prev.filter((s) => s.id !== id)),
    removeSpell: (id: number) => setSpells((prev) => prev.filter((s) => s.id !== id)),
    removeItem: (id: number) => setItems((prev) => prev.filter((s) => s.id !== id)),
    maxQuantity,
    setItemQuantity: (id: number, quantity: number) =>
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, quantity: Math.min(maxQuantity, Math.max(1, quantity)) }
            : item
        )
      ),
    isCreatingSpecial,
    /** "Create new rule" from the special picker, with what was typed as the name. */
    openNewSpecial: (name: string) => {
      setIsCreatingSpecial(true);
      setNewSpecialName(name);
    },
    closeNewSpecial,
    newSpecialName,
    setNewSpecialName,
    newSpecialDescription,
    setNewSpecialDescription,
    isSavingSpecial,
    specialError,
    createNewSpecial,
    /** The links' part of a create body. */
    payload: () => ({
      special_ids: specials.map((s) => s.id),
      skill_ids: skills.map((s) => s.id),
      spell_ids: spells.map((s) => s.id),
      item_entries: items.map((item) => ({ item_id: item.id, quantity: item.quantity })),
    }),
    load,
    /** Nothing linked and no special being created. */
    reset: () => load(null),
  };
}

export type BestiaryLinks = ReturnType<typeof useBestiaryLinks>;
