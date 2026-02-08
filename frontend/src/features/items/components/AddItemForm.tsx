import { useEffect, useMemo, useState } from "react";

import { Button } from "@components/button";
import { Checkbox } from "@components/checkbox";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/select";
import { ActionSearchDropdown, ActionSearchInput } from "@components/action-search-input";

import { X } from "lucide-react";

import {
  createItem,
  createItemProperty,
  listItemProperties,
} from "../api/items-api";

import type { Item, ItemProperty } from "../types/item-types";

type ItemFormState = {
  name: string;
  type: string;
  subtype: string;
  cost: string;
  variable: string;
  singleUse: boolean;
  rarity: string;
  uniqueTo: string;
  description: string;
  strength: string;
  range: string;
  save: string;
  statblock: StatblockState;
};

const STAT_KEYS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
type StatKey = (typeof STAT_KEYS)[number];
type StatblockState = Record<StatKey, string>;

type AddItemFormProps = {
  campaignId: number;
  onCreated: (item: Item) => void;
  onCancel: () => void;
};

const createEmptyStatblock = (): StatblockState =>
  STAT_KEYS.reduce<StatblockState>(
    (acc, key) => ({ ...acc, [key]: "" }),
    {
      M: "",
      WS: "",
      BS: "",
      S: "",
      T: "",
      W: "",
      I: "",
      A: "",
      Ld: "",
    }
  );

const initialState: ItemFormState = {
  name: "",
  type: "",
  subtype: "",
  cost: "",
  variable: "",
  singleUse: false,
  rarity: "",
  uniqueTo: "",
  description: "",
  strength: "",
  range: "",
  save: "",
  statblock: createEmptyStatblock(),
};

const itemTypeOptions = ["Weapon", "Armour", "Animal", "Miscellaneous"];
const itemSubtypeOptions: Record<string, string[]> = {
  Weapon: ["Melee", "Ranged", "Blackpowder"],
  Armour: ["Armour", "Shield", "Helmet", "Barding"],
  Animal: ["Mount", "Attack"],
};

export default function AddItemForm({
  campaignId,
  onCreated,
  onCancel,
}: AddItemFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<ItemFormState>(initialState);
  const [showFluff, setShowFluff] = useState(false);
  const [selectedProperties, setSelectedProperties] = useState<ItemProperty[]>([]);
  const [availableProperties, setAvailableProperties] = useState<ItemProperty[]>([]);
  const [propertySearch, setPropertySearch] = useState("");
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyDescription, setNewPropertyDescription] = useState("");
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);

  const resetForm = () => {
    setForm(initialState);
    setSelectedProperties([]);
    setFormError("");
    setShowFluff(false);
    setPropertySearch("");
    setShowPropertyForm(false);
    setNewPropertyName("");
    setNewPropertyDescription("");
  };

  useEffect(() => {
    if (form.type) {
      listItemProperties({
        type: form.type,
        search: propertySearch,
        campaignId,
      })
        .then((properties) => setAvailableProperties(properties))
        .catch(() => setAvailableProperties([]));
    } else {
      setAvailableProperties([]);
    }
  }, [form.type, propertySearch, campaignId]);

  useEffect(() => {
    setSelectedProperties((prev) =>
      prev.map((property) =>
        availableProperties.find((p) => p.id === property.id) ?? property
      )
    );
  }, [availableProperties]);

  useEffect(() => {
    setPropertySearch("");
    setShowPropertyForm(false);
  }, [form.type]);

  const handleSelectProperty = (property: ItemProperty) => {
    if (!selectedProperties.find((p) => p.id === property.id)) {
      setSelectedProperties([...selectedProperties, property]);
      setPropertySearch("");
    }
  };

  const handleRemoveProperty = (propertyId: number) => {
    setSelectedProperties(selectedProperties.filter((p) => p.id !== propertyId));
  };

  const handleCreateProperty = async () => {
    if (!newPropertyName.trim() || !form.type) {
      return;
    }

    setIsCreatingProperty(true);
    try {
      const newProperty = await createItemProperty({
        name: newPropertyName.trim(),
        description: newPropertyDescription.trim(),
        type: form.type,
        campaign_id: campaignId,
      });
      setSelectedProperties([...selectedProperties, newProperty]);
      setAvailableProperties([...availableProperties, newProperty]);
      setNewPropertyName("");
      setNewPropertyDescription("");
      setPropertySearch("");
    } catch (error) {
      console.error("Failed to create property:", error);
    } finally {
      setIsCreatingProperty(false);
    }
  };

  const buildPayload = () => {
    const hasStatblockValues = STAT_KEYS.some((key) => form.statblock[key].trim());
    const rarityValue = Number(form.rarity);
    return {
      name: form.name.trim(),
      type: form.type.trim(),
      subtype:
        form.type === "Weapon" || form.type === "Armour" || form.type === "Animal"
          ? form.subtype.trim()
          : "",
      cost: Number(form.cost),
      rarity: rarityValue,
      unique_to: form.uniqueTo.trim(),
      variable: form.variable.trim() || null,
      single_use: form.type === "Miscellaneous" ? form.singleUse : false,
      description: form.description.trim(),
      strength: form.strength.trim() || null,
      range: form.range.trim() || null,
      save: form.save.trim() || null,
      statblock:
        form.type === "Animal" && hasStatblockValues
          ? JSON.stringify(form.statblock)
          : null,
      property_ids: selectedProperties.map((p) => p.id),
    };
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.type.trim() || !form.cost.trim() || !form.rarity.trim()) {
      setFormError("Name, type, price, and rarity are required.");
      return;
    }

    const rarityValue = Number(form.rarity);
    if (Number.isNaN(rarityValue) || rarityValue < 2 || rarityValue > 20) {
      setFormError("Rarity must be between 2 and 20.");
      return;
    }

    if (Number.isNaN(campaignId)) {
      setFormError("Unable to create item.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const newItem = await createItem({
        ...buildPayload(),
        campaign_id: campaignId,
      });
      onCreated(newItem);
      resetForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to save item");
      } else {
        setFormError("Unable to save item");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <div className="space-y-3 border border-border/60 bg-background/80 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Name</label>
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
            placeholder="Gutterblade"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Type</label>
          <Select
            value={form.type}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                type: value,
                subtype: itemSubtypeOptions[value]?.[0] ?? "",
                statblock: value === "Animal" ? prev.statblock : createEmptyStatblock(),
                singleUse: value === "Miscellaneous" ? prev.singleUse : false,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {itemTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(form.type === "Weapon" || form.type === "Armour" || form.type === "Animal") ? (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Subtype</label>
            <Select
              value={form.subtype}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  subtype: value,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a subtype" />
              </SelectTrigger>
              <SelectContent>
                {(itemSubtypeOptions[form.type] ?? []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {form.type === "Weapon" ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Strength</label>
              <Input
                value={form.strength}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    strength: event.target.value,
                  }))
                }
                placeholder="As user"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Range</label>
              <Input
                value={form.range}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    range: event.target.value,
                  }))
                }
                placeholder="Close combat or 6/12"
              />
            </div>
          </>
        ) : null}
        {form.type === "Armour" ? (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Save</label>
            <Input
              value={form.save}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  save: event.target.value,
                }))
              }
              placeholder="6+"
            />
          </div>
        ) : null}
      </div>

      {form.type === "Animal" && (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Statblock</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
            {STAT_KEYS.map((key) => (
              <div key={key}>
                <Label className="text-[10px] uppercase tracking-[0.2em]">{key}</Label>
                <Input
                  value={form.statblock[key]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      statblock: {
                        ...prev.statblock,
                        [key]: event.target.value,
                      },
                    }))
                  }
                  className="h-9 px-2 text-center text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Price</label>
          <NumberInput
            min={0}
            step={1}
            value={form.cost}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                cost: event.target.value,
              }))
            }
            placeholder="25"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Rarity <span className="text-[10px] text-muted-foreground">(2 for common)</span>
          </label>
          <NumberInput
            min={2}
            max={20}
            step={1}
            value={form.rarity}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                rarity: event.target.value,
              }))
            }
            placeholder="2"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Variable cost</label>
          <Input
            value={form.variable}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                variable: event.target.value,
              }))
            }
            placeholder="+2d6"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Restricted to</label>
          <Input
            value={form.uniqueTo}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                uniqueTo: event.target.value,
              }))
            }
            placeholder="Skaven only"
          />
        </div>
        {form.type === "Miscellaneous" && (
          <div className="flex items-end gap-2 pb-2">
            <Checkbox
              id="item-single-use"
              checked={form.singleUse}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  singleUse: event.target.checked,
                }))
              }
            />
            <Label htmlFor="item-single-use">Single use</Label>
          </div>
        )}
      </div>

      {form.type && (
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground">Properties</label>
          <ActionSearchInput
            placeholder="Search properties..."
            value={propertySearch}
            onChange={(e) => setPropertySearch(e.target.value)}
            onAction={() => setShowPropertyForm(!showPropertyForm)}
            actionLabel="Create"
          >
            <ActionSearchDropdown
              open={propertySearch.length > 0 && availableProperties.length > 0}
              onClose={() => setPropertySearch("")}
              className="rounded-lg border-input/80"
            >
              <div className="max-h-40 overflow-y-auto">
                {availableProperties
                  .filter((prop) => !selectedProperties.find((sp) => sp.id === prop.id))
                  .map((property) => (
                    <button
                      key={property.id}
                      type="button"
                      onClick={() => handleSelectProperty(property)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent/50"
                      title={property.description}
                    >
                      {property.name}
                    </button>
                  ))}
              </div>
            </ActionSearchDropdown>
          </ActionSearchInput>
          {showPropertyForm && (
            <div className="space-y-2 rounded-lg border border-input/80 bg-background/40 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Property name</label>
                  <Input
                    value={newPropertyName}
                    onChange={(e) => setNewPropertyName(e.target.value)}
                    placeholder="Battle Schooled"
                  />
                </div>
                <div className="sm:col-span-1 lg:col-span-3">
                  <label className="mb-1 block text-xs text-muted-foreground">Description</label>
                  <Input
                    value={newPropertyDescription}
                    onChange={(e) => setNewPropertyDescription(e.target.value)}
                    placeholder="Describe this property..."
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateProperty}
                disabled={isCreatingProperty || !newPropertyName.trim()}
                size="sm"
              >
                {isCreatingProperty ? "Creating..." : "Add property"}
              </Button>
            </div>
          )}
          {selectedProperties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedProperties.map((property) => (
                <div
                  key={property.id}
                  className="group relative inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-sm"
                  title={property.description}
                >
                  <span>{property.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProperty(property.id)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id="add-fluff-toggle"
          checked={showFluff}
          onChange={(e) => setShowFluff(e.target.checked)}
        />
        <Label htmlFor="add-fluff-toggle">Add fluff</Label>
      </div>
      {showFluff && (
        <textarea
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              description: event.target.value,
            }))
          }
          placeholder="Describe the item."
          rows={2}
          className="min-h-[80px] w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
        />
      )}

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" onClick={handleCancel} disabled={isSaving} size="sm">
          Cancel
        </Button>
      </div>
    </div>
  );
}
