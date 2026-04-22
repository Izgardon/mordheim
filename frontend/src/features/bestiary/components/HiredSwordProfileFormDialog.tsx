//
//
//
// NEEDS REWORK
//
//
//
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createHiredSwordProfile } from "../api/bestiary-api";
import { createSpecial } from "@/features/special/api/special-api";
import { useCampaignItems } from "@/features/warbands/hooks/campaign/useCampaignItems";
import { useCampaignSkills } from "@/features/warbands/hooks/campaign/useCampaignSkills";
import { useCampaignSpells } from "@/features/warbands/hooks/campaign/useCampaignSpells";
import { useCampaignSpecial } from "@/features/warbands/hooks/campaign/useCampaignSpecial";
import SearchablePickerSection from "./SearchablePickerSection";
import { skillAbbrevToType } from "@/features/warbands/utils/warband-utils";
import { useAppStore } from "@/stores/app-store";

import type { HiredSwordProfile } from "../types/bestiary-types";
import type { Special } from "@/features/special/types/special-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";
import type { Item } from "@/features/items/types/item-types";

const STAT_FIELDS = [
  { key: "movement", label: "M" },
  { key: "weapon_skill", label: "WS" },
  { key: "ballistic_skill", label: "BS" },
  { key: "strength", label: "S" },
  { key: "toughness", label: "T" },
  { key: "wounds", label: "W" },
  { key: "initiative", label: "I" },
  { key: "attacks", label: "A" },
  { key: "leadership", label: "Ld" },
] as const;

type StatKey = (typeof STAT_FIELDS)[number]["key"];

const CASTER_OPTIONS = ["No", "Wizard", "Priest"];

const SKILL_TYPE_FIELDS = Object.entries(skillAbbrevToType).map(([key, label]) => ({
  key,
  label,
}));

type FormState = {
  name: string;
  description: string;
  stats: Record<StatKey, string>;
  armour_save: string;
  large: boolean;
  caster: string;
  hire_cost: string;
  hire_cost_expression: string;
  upkeep_cost: string;
  upkeep_cost_expression: string;
  available_skill_types: string[];
};

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  stats: {
    movement: "0",
    weapon_skill: "0",
    ballistic_skill: "0",
    strength: "0",
    toughness: "0",
    wounds: "1",
    initiative: "0",
    attacks: "1",
    leadership: "0",
  },
  armour_save: "",
  large: false,
  caster: "No",
  hire_cost: "",
  hire_cost_expression: "",
  upkeep_cost: "",
  upkeep_cost_expression: "",
  available_skill_types: [],
};

type SelectedItem = Item & { quantity: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  onCreated: (profile: HiredSwordProfile) => void;
};

export default function HiredSwordProfileFormDialog({
  open,
  onOpenChange,
  campaignId,
  onCreated,
}: Props) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });
  const [selectedSpecials, setSelectedSpecials] = useState<Special[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [selectedSpells, setSelectedSpells] = useState<Spell[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const [creatingSpecial, setCreatingSpecial] = useState(false);
  const [newSpecialName, setNewSpecialName] = useState("");
  const [newSpecialDescription, setNewSpecialDescription] = useState("");
  const [savingSpecial, setSavingSpecial] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const campaignEnabled = open && !Number.isNaN(campaignId);
  const campaignLookupParams = { campaignId, hasCampaignId: !Number.isNaN(campaignId), enabled: campaignEnabled };
  const { availableSpecials } = useCampaignSpecial(campaignLookupParams);
  const { availableSkills } = useCampaignSkills(campaignLookupParams);
  const { availableSpells } = useCampaignSpells(campaignLookupParams);
  const { availableItems } = useCampaignItems(campaignLookupParams);
  const campaignKey = Number.isNaN(campaignId) ? "base" : `campaign:${campaignId}`;
  const { upsertSpecialCache } = useAppStore();

  const addSpecial = useCallback((special: Special) => {
    setSelectedSpecials((prev) =>
      prev.some((s) => s.id === special.id) ? prev : [...prev, special]
    );
  }, []);

  const addSkill = useCallback((skill: Skill) => {
    setSelectedSkills((prev) =>
      prev.some((s) => s.id === skill.id) ? prev : [...prev, skill]
    );
  }, []);

  const addSpell = useCallback((spell: Spell) => {
    setSelectedSpells((prev) =>
      prev.some((s) => s.id === spell.id) ? prev : [...prev, spell]
    );
  }, []);

  const addItem = useCallback((item: Item) => {
    setSelectedItems((prev) =>
      prev.some((s) => s.id === item.id)
        ? prev
        : [...prev, { ...item, quantity: 1 }]
    );
  }, []);

  const setItemQuantity = useCallback((id: number, quantity: number) => {
    setSelectedItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
      )
    );
  }, []);

  const handleCreateSpecial = useCallback(async () => {
    const name = newSpecialName.trim();
    if (!name) return;
    setSavingSpecial(true);
    try {
      const created = await createSpecial({
        campaign_id: campaignId,
        name,
        type: "Hired Sword",
        description: newSpecialDescription.trim(),
      });
      upsertSpecialCache(campaignKey, created);
      setSelectedSpecials((prev) => [...prev, created]);
      setNewSpecialName("");
      setNewSpecialDescription("");
      setCreatingSpecial(false);
    } catch {
      // keep form open so user can retry
    } finally {
      setSavingSpecial(false);
    }
  }, [campaignId, campaignKey, newSpecialDescription, newSpecialName, upsertSpecialCache]);

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM });
    setSelectedSpecials([]);
    setSelectedSkills([]);
    setSelectedSpells([]);
    setSelectedItems([]);
    setCreatingSpecial(false);
    setNewSpecialName("");
    setNewSpecialDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);
    setError("");

    try {
      const hireCostNum = form.hire_cost ? Number(form.hire_cost) : null;
      const upkeepCostNum = form.upkeep_cost ? Number(form.upkeep_cost) : null;

      const payload = {
        campaign_id: campaignId,
        name: form.name.trim(),
        type: "Hired Sword",
        description: form.description.trim(),
        movement: Number(form.stats.movement) || 0,
        weapon_skill: Number(form.stats.weapon_skill) || 0,
        ballistic_skill: Number(form.stats.ballistic_skill) || 0,
        strength: Number(form.stats.strength) || 0,
        toughness: Number(form.stats.toughness) || 0,
        wounds: Number(form.stats.wounds) || 0,
        initiative: Number(form.stats.initiative) || 0,
        attacks: Number(form.stats.attacks) || 0,
        leadership: Number(form.stats.leadership) || 0,
        armour_save: form.armour_save.trim() ? (parseInt(form.armour_save.trim(), 10) || null) : null,
        large: form.large,
        caster: form.caster,
        special_ids: selectedSpecials.map((s) => s.id),
        skill_ids: selectedSkills.map((s) => s.id),
        spell_ids: selectedSpells.map((s) => s.id),
        item_entries: selectedItems.map((i) => ({
          item_id: i.id,
          quantity: i.quantity,
        })),
        hire_cost: hireCostNum,
        hire_cost_expression: form.hire_cost_expression.trim(),
        upkeep_cost: upkeepCostNum,
        upkeep_cost_expression: form.upkeep_cost_expression.trim(),
        available_skill_types: form.available_skill_types,
      };
      const profile = await createHiredSwordProfile(payload);
      onCreated(profile);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create hired sword"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Hired Sword</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hs-name">Name</Label>
            <Input
              id="hs-name"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Ogre Bodyguard"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Caster</Label>
              <Select
                value={form.caster}
                onValueChange={(v) => setForm((f) => ({ ...f, caster: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASTER_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hs-desc">Description</Label>
            <textarea
              id="hs-desc"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Description..."
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hs-hire-cost">Hire Cost (gc)</Label>
              <Input
                id="hs-hire-cost"
                type="number"
                min={0}
                value={form.hire_cost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hire_cost: e.target.value }))
                }
                placeholder="e.g. 80"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hs-hire-expr">or Expression</Label>
              <Input
                id="hs-hire-expr"
                value={form.hire_cost_expression}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    hire_cost_expression: e.target.value,
                  }))
                }
                placeholder="e.g. 2D6x10"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hs-upkeep-cost">Upkeep Cost (gc)</Label>
              <Input
                id="hs-upkeep-cost"
                type="number"
                min={0}
                value={form.upkeep_cost}
                onChange={(e) =>
                  setForm((f) => ({ ...f, upkeep_cost: e.target.value }))
                }
                placeholder="e.g. 30"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="hs-upkeep-expr">or Expression</Label>
              <Input
                id="hs-upkeep-expr"
                value={form.upkeep_cost_expression}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    upkeep_cost_expression: e.target.value,
                  }))
                }
                placeholder="e.g. D6x5"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Available Skill Types</Label>
            <div className="flex flex-wrap gap-3">
              {SKILL_TYPE_FIELDS.map(({ key: _key, label }) => (
                <label key={label} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.available_skill_types.includes(label)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        available_skill_types: e.target.checked
                          ? [...f.available_skill_types, label]
                          : f.available_skill_types.filter((t) => t !== label),
                      }))
                    }
                    className="h-4 w-4 rounded border-input"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Stats</Label>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {STAT_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={form.stats[field.key]}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        stats: { ...f.stats, [field.key]: e.target.value },
                      }))
                    }
                    className="h-8 w-full px-1 text-center text-sm"
                  />
                </div>
              ))}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-medium text-muted-foreground">
                  AS
                </span>
                <Input
                  value={form.armour_save}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, armour_save: e.target.value }))
                  }
                  className="h-8 w-full px-1 text-center text-sm"
                  placeholder="-"
                />
              </div>
            </div>
          </div>

          {creatingSpecial ? (
            <div className="flex flex-col gap-1.5">
              <Label>Special Rules</Label>
              <div className="flex flex-col gap-2 rounded-md border border-input bg-background/60 p-3">
                <Input
                  value={newSpecialName}
                  onChange={(e) => setNewSpecialName(e.target.value)}
                  placeholder="Rule name"
                  autoFocus
                />
                <textarea
                  value={newSpecialDescription}
                  onChange={(e) => setNewSpecialDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingSpecial || !newSpecialName.trim()}
                    onClick={handleCreateSpecial}
                  >
                    {savingSpecial ? "Saving..." : "Add rule"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCreatingSpecial(false);
                      setNewSpecialName("");
                      setNewSpecialDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <SearchablePickerSection
              label="Special Rules"
              placeholder="Search special rules..."
              items={availableSpecials}
              selected={selectedSpecials}
              onSelect={addSpecial}
              onRemove={(id) =>
                setSelectedSpecials((prev) => prev.filter((s) => s.id !== id))
              }
              onCreateNew={(text) => {
                setCreatingSpecial(true);
                setNewSpecialName(text);
              }}
              createNewLabel="Create new rule"
            />
          )}

          <SearchablePickerSection
            label="Skills"
            placeholder="Search skills..."
            items={availableSkills}
            selected={selectedSkills}
            onSelect={addSkill}
            onRemove={(id) =>
              setSelectedSkills((prev) => prev.filter((s) => s.id !== id))
            }
          />

          <SearchablePickerSection
            label="Spells"
            placeholder="Search spells..."
            items={availableSpells}
            selected={selectedSpells}
            onSelect={addSpell}
            onRemove={(id) =>
              setSelectedSpells((prev) => prev.filter((s) => s.id !== id))
            }
          />

          <SearchablePickerSection
            label="Equipment"
            placeholder="Search items..."
            items={availableItems}
            selected={selectedItems}
            onSelect={addItem}
            onRemove={(id) =>
              setSelectedItems((prev) => prev.filter((s) => s.id !== id))
            }
            renderSelectedExtra={(item) => (
              <input
                type="number"
                min={1}
                max={99}
                value={(item as SelectedItem).quantity}
                onChange={(e) =>
                  setItemQuantity(item.id, Number(e.target.value) || 1)
                }
                onClick={(e) => e.stopPropagation()}
                className="ml-1 h-5 w-10 rounded border border-input bg-background px-1 text-center text-xs"
                aria-label={`Quantity for ${item.name}`}
              />
            )}
          />

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.large}
              onChange={(e) =>
                setForm((f) => ({ ...f, large: e.target.checked }))
              }
              className="h-4 w-4 rounded border-input"
            />
            Large target
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
