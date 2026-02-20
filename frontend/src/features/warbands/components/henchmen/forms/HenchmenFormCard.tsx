import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@components/button";
import { Input } from "@components/input";
import { NumberInput } from "@components/number-input";
import { Label } from "@components/label";
import { Checkbox } from "@components/checkbox";
import { ConfirmDialog } from "@components/confirm-dialog";
import UnitStatsGrid from "../../shared/forms/UnitStatsGrid";
import SearchableDropdown from "../../shared/forms/SearchableDropdown";
import CreateRaceDialog from "../../../../races/components/CreateRaceDialog";
import ItemFormDialog from "../../../../items/components/ItemFormDialog";
import SkillFormDialog from "../../../../skills/components/SkillFormDialog";
import CreateSpecialDialog from "../../../../special/components/CreateSpecialDialog";
import AcquireItemDialog from "../../../../items/components/AcquireItemDialog/AcquireItemDialog";
import { isPendingByType } from "../../heroes/utils/pending-entries";
import { calculateHenchmenReinforceCost, getHenchmenItemMultiplier } from "../utils/henchmen-cost";

import type { Item } from "../../../../items/types/item-types";
import type { Special } from "../../../../special/types/special-types";
import type { Race } from "../../../../races/types/race-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HenchmenGroupFormEntry } from "../../../types/warband-types";
import type { HenchmenGroupValidationError } from "../../../utils/warband-utils";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import type { UnitTypeOption } from "@components/unit-selection-section";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

type HenchmenFormCardProps = {
  group: HenchmenGroupFormEntry;
  index: number;
  campaignId: number;
  statFields: readonly string[];
  availableRaces: Race[];
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpecials: Special[];
  canAddCustom?: boolean;
  onUpdate: (index: number, updater: (group: HenchmenGroupFormEntry) => HenchmenGroupFormEntry) => void;
  onRemove: (index: number) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  onRaceCreated: (race: Race) => void;
  deferItemCommit?: boolean;
  reservedGold?: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  onPendingPurchaseRemove?: (match: { unitType: UnitTypeOption; unitId: string; itemId: number }) => void;
  error?: HenchmenGroupValidationError | null;
};

const getHenchmanHireCost = (group: HenchmenGroupFormEntry) => {
  return calculateHenchmenReinforceCost({
    price: group.price,
    xp: group.xp,
    items: group.items,
    henchmen: group.henchmen,
  }).totalCost;
};

const getAddedItemsForNewHenchman = (group: HenchmenGroupFormEntry) => {
  if (!group.items.length) {
    return [];
  }

  const itemCounts = group.items.reduce<Record<number, { item: Item; count: number }>>(
    (acc, item) => {
      if (acc[item.id]) {
        acc[item.id].count += 1;
      } else {
        acc[item.id] = { item, count: 1 };
      }
      return acc;
    },
    {}
  );
  const henchmenCount = group.henchmen.length;
  const itemsToAdd: Item[] = [];

  Object.values(itemCounts).forEach(({ item, count }) => {
    const perHenchman = getHenchmenItemMultiplier(count, henchmenCount);
    for (let i = 0; i < perHenchman; i += 1) {
      itemsToAdd.push(item);
    }
  });

  return itemsToAdd;
};

export default function HenchmenFormCard({
  group,
  index,
  campaignId,
  statFields,
  availableRaces,
  availableItems,
  availableSkills,
  availableSpecials,
  canAddCustom = false,
  onUpdate,
  onRemove,
  onItemCreated,
  onSkillCreated,
  onRaceCreated,
  deferItemCommit = false,
  reservedGold = 0,
  onPendingPurchaseAdd,
  onPendingPurchaseRemove,
  error,
}: HenchmenFormCardProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [henchmanToRemove, setHenchmanToRemove] = useState<number | null>(null);
  const [raceQuery, setRaceQuery] = useState(group.race_name ?? "");
  const [isRaceDialogOpen, setIsRaceDialogOpen] = useState(false);
  const [isRaceListOpen, setIsRaceListOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "skills" | "special" | "henchmen">("henchmen");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [isAddingSkill, setIsAddingSkill] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const [isAddingSpecial, setIsAddingSpecial] = useState(false);
  const [specialQuery, setSpecialQuery] = useState("");
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [isSpecialDialogOpen, setIsSpecialDialogOpen] = useState(false);
  const [buyItemDialogOpen, setBuyItemDialogOpen] = useState(false);
  const [buyItemTarget, setBuyItemTarget] = useState<Item | null>(null);
  const [isDeedsOpen, setIsDeedsOpen] = useState(false);
  const draftGroupIdRef = useRef<string | null>(null);
  if (!draftGroupIdRef.current) {
    draftGroupIdRef.current = `draft-henchmen-${Date.now()}-${index}`;
  }
  const draftGroupId = draftGroupIdRef.current;
  const isDraftGroup = !group.id;
  const draftUnit = isDraftGroup
    ? {
        unitType: "henchmen" as const,
        id: draftGroupId,
        name: group.name ?? null,
        unit_type: group.unit_type ?? null,
      }
    : undefined;

  const groupName = group.name?.trim() || `Group ${index + 1}`;
  const inputClassName =
    "bg-background/70 border-border/60 text-foreground placeholder:text-muted-foreground";
  const defaultHireCost = getHenchmanHireCost(group);

  useEffect(() => {
    setRaceQuery(group.race_name ?? "");
  }, [group.race_name, group.race_id]);

  const hasFieldError = (field: string) =>
    Boolean(error?.fields?.includes(field as HenchmenGroupValidationError["fields"][number]));

  const matchingRaces = availableRaces.filter(
    (race) =>
      race.id !== group.race_id &&
      (!raceQuery.trim() || race.name.toLowerCase().includes(raceQuery.trim().toLowerCase()))
  );

  const matchingItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    return availableItems.filter((item) => (query ? item.name.toLowerCase().includes(query) : true));
  }, [availableItems, itemQuery]);

  const matchingSkills = useMemo(() => {
    const query = skillQuery.trim().toLowerCase();
    return availableSkills.filter((skill) => (query ? skill.name.toLowerCase().includes(query) : true));
  }, [availableSkills, skillQuery]);

  const matchingSpecials = useMemo(() => {
    const query = specialQuery.trim().toLowerCase();
    return availableSpecials.filter((entry) => (query ? entry.name.toLowerCase().includes(query) : true));
  }, [availableSpecials, specialQuery]);

  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

  const specialTypeOptions = useMemo(() => {
    const unique = new Set(availableSpecials.map((entry) => entry.type).filter(isNonEmptyString));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSpecials]);

  const visibleSkills = useMemo(() => group.skills.filter((s) => !isPendingByType(s)), [group.skills]);
  const visibleSpecials = useMemo(() => group.specials.filter((f) => !isPendingByType(f)), [group.specials]);

  const handleConfirmRemove = () => {
    setIsRemoveDialogOpen(false);
    onRemove(index);
  };

  const handleAddItem = (item: Item) => {
    onUpdate(index, (current) => ({ ...current, items: [...current.items, item] }));
  };

  const handleSelectItem = (item: Item) => {
    setBuyItemTarget(item);
    setBuyItemDialogOpen(true);
    setIsAddingItem(false);
    setItemQuery("");
  };

  const handleCreatedItem = (item: Item) => {
    onItemCreated(index, item);
    setItemQuery("");
    setIsAddingItem(false);
    setBuyItemTarget(item);
    setBuyItemDialogOpen(true);
  };

  const handleRemoveItem = (itemIndex: number) => {
    const removed = group.items[itemIndex];
    onUpdate(index, (current) => ({ ...current, items: current.items.filter((_, i) => i !== itemIndex) }));
    if (deferItemCommit && removed && group.id && onPendingPurchaseRemove) {
      onPendingPurchaseRemove({ unitType: "henchmen", unitId: String(group.id), itemId: removed.id });
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

  const handleAddSpecial = (entry: Special) => {
    onUpdate(index, (current) => {
      const pendingIdx = current.specials.findIndex((f) => isPendingByType(f));
      const cleaned = pendingIdx !== -1 ? current.specials.filter((_, i) => i !== pendingIdx) : current.specials;
      const updated: Partial<HenchmenGroupFormEntry> = {};
      const n = entry.name.trim().toLowerCase();
      if (n === "large") updated.large = true;
      return { ...current, ...updated, specials: [...cleaned, entry] };
    });
    setSpecialQuery("");
    setIsAddingSpecial(false);
  };

  const handleRemoveSkill = (skillIndex: number) => {
    onUpdate(index, (current) => ({ ...current, skills: current.skills.filter((_, i) => i !== skillIndex) }));
  };

  const handleRemoveSpecial = (specialIndex: number) => {
    onUpdate(index, (current) => {
      const removed = current.specials[specialIndex];
      const updated: Partial<HenchmenGroupFormEntry> = {};
      if (removed) {
        const n = removed.name.trim().toLowerCase();
        if (n === "large") updated.large = false;
      }
      return { ...current, ...updated, specials: current.specials.filter((_, i) => i !== specialIndex) };
    });
  };

  const handleAddHenchman = () => {
    onUpdate(index, (current) => ({
      ...current,
      items: [...current.items, ...getAddedItemsForNewHenchman(current)],
      henchmen: [
        ...current.henchmen,
        {
          id: 0,
          name: "",
          kills: 0,
          dead: false,
          ...(current.id ? { cost: String(getHenchmanHireCost(current)) } : {}),
        },
      ],
    }));
  };

  const handleUpdateHenchman = (hIdx: number, field: string, value: string | number | boolean) => {
    onUpdate(index, (current) => ({
      ...current,
      henchmen: current.henchmen.map((h, i) =>
        i === hIdx ? { ...h, [field]: value } : h
      ),
    }));
  };

  const handleRemoveHenchman = (hIdx: number) => {
    onUpdate(index, (current) => ({
      ...current,
      henchmen: current.henchmen.filter((_, i) => i !== hIdx),
    }));
  };

  return (
    <div className="relative space-y-4 overflow-visible rounded-2xl border border-border/60 bg-card/80 p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setIsRemoveDialogOpen(true)}
        className="absolute right-2 top-2"
      >
        Disband
      </Button>

      <ConfirmDialog
        open={isRemoveDialogOpen}
        onOpenChange={setIsRemoveDialogOpen}
        description={
          <span>
            Are you sure you want to disband{" "}
            <span className="font-semibold text-foreground">{groupName}</span>? This
            action cannot be undone.
          </span>
        }
        confirmText="Disband group"
        onConfirm={handleConfirmRemove}
        onCancel={() => setIsRemoveDialogOpen(false)}
      />

      <CreateRaceDialog
        campaignId={campaignId}
        onCreated={(race) => {
          onRaceCreated(race);
          onUpdate(index, (current) => ({ ...current, race_id: race.id, race_name: race.name }));
          setRaceQuery(race.name);
        }}
        open={isRaceDialogOpen}
        onOpenChange={setIsRaceDialogOpen}
        trigger={null}
      />

      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Henchmen Group {index + 1}
      </div>

      {error && <p className="text-xs font-semibold text-red-500">{error.message}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {/* Basic info */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className={`text-sm font-semibold text-foreground ${hasFieldError("name") ? "text-red-500" : ""}`}>
                Group name
              </Label>
              <Input
                value={group.name}
                onChange={(e) => onUpdate(index, (c) => ({ ...c, name: e.target.value }))}
                placeholder="Group name"
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className={`text-sm font-semibold text-foreground ${hasFieldError("unit_type") ? "text-red-500" : ""}`}>
                Unit type
              </Label>
              <Input
                value={group.unit_type}
                onChange={(e) => onUpdate(index, (c) => ({ ...c, unit_type: e.target.value }))}
                placeholder="Warrior, Zombie"
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className={`text-sm font-semibold text-foreground ${hasFieldError("race_id") ? "text-red-500" : ""}`}>
                Race
              </Label>
              <SearchableDropdown
                query={raceQuery}
                onQueryChange={(value) => {
                  setRaceQuery(value);
                  onUpdate(index, (c) => ({ ...c, race_id: null, race_name: "" }));
                }}
                placeholder="Search races..."
                inputClassName={inputClassName}
                items={matchingRaces}
                isOpen={isRaceListOpen}
                onFocus={() => setIsRaceListOpen(true)}
                onBlur={() => setIsRaceListOpen(false)}
                onSelectItem={(race) => {
                  onUpdate(index, (c) => ({ ...c, race_id: race.id, race_name: race.name }));
                  setRaceQuery(race.name);
                  setIsRaceListOpen(false);
                }}
                renderItem={(race) => <span className="font-semibold">{race.name}</span>}
                getItemKey={(race) => race.id}
                canCreate
                onCreateClick={() => setIsRaceDialogOpen(true)}
                createLabel="Create"
              />
            </div>
          </div>

          {/* Traits */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-background/50 p-3">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <Checkbox
                checked={group.large}
                onChange={(e) =>
                  onUpdate(index, (c) => {
                    const checked = e.target.checked;
                    let specials = c.specials;
                    const hasLarge = specials.some((s) => s.name.trim().toLowerCase() === "large");
                    if (checked && !hasLarge) {
                      const match = availableSpecials.find((s) => s.name.trim().toLowerCase() === "large");
                      if (match) specials = [...specials, match];
                    } else if (!checked && hasLarge) {
                      specials = specials.filter((s) => s.name.trim().toLowerCase() !== "large");
                    }
                    return { ...c, large: checked, specials };
                  })
                }
              />
              Large
            </label>
          </div>

          {/* XP / Price */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex min-h-[28px] flex-wrap items-center gap-2">
                <Label className="text-sm font-semibold text-foreground">Experience</Label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Checkbox
                    checked={group.half_rate}
                    onChange={(e) => onUpdate(index, (c) => ({ ...c, half_rate: e.target.checked }))}
                  />
                  <span>(Half rate experience)</span>
                </label>
              </div>
              <NumberInput
                min={0}
                step={group.half_rate ? 0.5 : 1}
                value={group.xp}
                onChange={(e) => onUpdate(index, (c) => ({ ...c, xp: e.target.value }))}
                placeholder="0"
                className={inputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Recruit cost</Label>
              <NumberInput
                min={0}
                value={group.price}
                onChange={(e) => onUpdate(index, (c) => ({ ...c, price: e.target.value }))}
                placeholder="0"
                className={inputClassName}
              />
            </div>
          </div>

          {/* Stats */}
              <UnitStatsGrid
                unit={group as any}
                index={index}
                statFields={statFields}
                inputClassName={inputClassName}
                onUpdate={onUpdate as any}
              />

          <div className="space-y-2 rounded border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold text-foreground">Deeds</Label>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setIsDeedsOpen((current) => !current)}
              >
                {isDeedsOpen ? "Hide" : "Show"}
              </button>
            </div>
            {isDeedsOpen ? (
              <textarea
                value={group.deeds}
                onChange={(event) =>
                  onUpdate(index, (current) => ({
                    ...current,
                    deeds: event.target.value,
                  }))
                }
                placeholder="Notable deeds, achievements, and scars..."
                rows={4}
                className={[
                  "min-h-[110px] w-full border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)]",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            ) : null}
          </div>
        </div>

        {/* Loadout tabs */}
        <div className="space-y-3 overflow-visible rounded-xl border border-border/60 bg-background/60 p-3">
          {canAddCustom && (
            <>
              <ItemFormDialog mode="create" campaignId={campaignId} onCreated={handleCreatedItem} open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen} trigger={null} />
              <SkillFormDialog mode="create" campaignId={campaignId} onCreated={(skill) => { onSkillCreated(index, skill); setSkillQuery(""); }} typeOptions={skillTypeOptions} open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen} trigger={null} />
              <CreateSpecialDialog campaignId={campaignId} onCreated={(entry) => { handleAddSpecial(entry); setSpecialQuery(""); }} typeOptions={specialTypeOptions} open={isSpecialDialogOpen} onOpenChange={setIsSpecialDialogOpen} trigger={null} />
            </>
          )}
          {buyItemTarget && (
            <AcquireItemDialog
              item={buyItemTarget}
              open={buyItemDialogOpen}
              onOpenChange={setBuyItemDialogOpen}
              trigger={null}
              variant="unit-edit"
              presetUnitType="henchmen"
              presetUnitId={group.id ?? draftGroupId ?? undefined}
              draftUnit={draftUnit}
              disableUnitSelection
              defaultUnitSectionCollapsed
              deferCommit={deferItemCommit}
              reservedGold={reservedGold}
              onPendingPurchaseAdd={onPendingPurchaseAdd}
              pendingPurchaseUnitId={group.id ?? undefined}
              onAcquire={(item, resolvedUnitType, unitId, meta) => {
                const targetUnitId = group.id ? String(group.id) : (draftGroupId ?? "");
                if (resolvedUnitType === "henchmen" && targetUnitId === unitId) {
                  const count = meta?.quantity ?? 1;
                  for (let i = 0; i < count; i += 1) {
                    handleAddItem(item);
                  }
                }
              }}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Loadout</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant={activeTab === "henchmen" ? "default" : "secondary"} size="sm" onClick={() => setActiveTab("henchmen")}>Roster</Button>
              <Button type="button" variant={activeTab === "items" ? "default" : "secondary"} size="sm" onClick={() => setActiveTab("items")}>Items</Button>
              <Button type="button" variant={activeTab === "skills" ? "default" : "secondary"} size="sm" onClick={() => setActiveTab("skills")}>Skills</Button>
              <Button type="button" variant={activeTab === "special" ? "default" : "secondary"} size="sm" onClick={() => setActiveTab("special")}>Special</Button>
            </div>
          </div>

          {activeTab === "henchmen" ? (
            <>
              <p className="text-xs text-muted-foreground">Group members</p>
              {group.henchmen.length === 0 ? (
                <p className="text-sm text-muted-foreground">No henchmen yet.</p>
              ) : (
                <div className="space-y-2">
                  {group.henchmen.map((henchman, hIdx) => (
                    <div key={henchman.id || `new-${hIdx}`} className="group flex items-center gap-2">
                      <Input
                        value={henchman.name}
                        onChange={(e) => handleUpdateHenchman(hIdx, "name", e.target.value)}
                        placeholder="Henchman name"
                        className={`${inputClassName} flex-1 ${hasFieldError("henchmen_names") && !henchman.name?.trim() ? "border-red-500" : ""}`}
                      />
                      {group.id && !henchman.id ? (
                        <NumberInput
                          min={0}
                          step={1}
                          value={
                            henchman.cost !== undefined && henchman.cost !== null && String(henchman.cost).trim() !== ""
                              ? String(henchman.cost)
                              : String(defaultHireCost)
                          }
                          onChange={(e) => handleUpdateHenchman(hIdx, "cost", e.target.value)}
                          placeholder="0"
                          aria-label="Hire cost"
                          className={`${inputClassName} w-24`}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100"
                        onClick={() => setHenchmanToRemove(hIdx)}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <ConfirmDialog
                open={henchmanToRemove !== null}
                onOpenChange={(open) => { if (!open) setHenchmanToRemove(null); }}
                description={
                  <span>
                    Are you sure you want to remove{" "}
                    <span className="font-semibold text-foreground">
                      {henchmanToRemove !== null
                        ? group.henchmen[henchmanToRemove]?.name || `Henchman ${henchmanToRemove + 1}`
                        : ""}
                    </span>
                    ? This action cannot be undone.
                  </span>
                }
                confirmText="Remove"
                onConfirm={() => {
                  if (henchmanToRemove !== null) handleRemoveHenchman(henchmanToRemove);
                  setHenchmanToRemove(null);
                }}
                onCancel={() => setHenchmanToRemove(null)}
              />
              <Button type="button" size="sm" onClick={handleAddHenchman}>+ Add henchman</Button>
            </>
          ) : activeTab === "items" ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Assigned items</p>
                <span className="text-xs text-muted-foreground">{group.items.length}</span>
              </div>
              {group.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items assigned yet.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map((item, itemIndex) => (
                    <div key={`${item.id}-${itemIndex}`} className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{item.type}</p>
                        </div>
                        <button type="button" className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100" onClick={() => handleRemoveItem(itemIndex)}>x</button>
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
                    inputClassName={`${inputClassName} h-12 max-w-[400px]`}
                    items={matchingItems}
                    isOpen={true}
                    onBlur={() => { setIsAddingItem(false); setItemQuery(""); }}
                    onSelectItem={handleSelectItem}
                    renderItem={(item) => (<><span className="font-semibold">{item.name}</span><span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{item.type}</span></>)}
                    getItemKey={(item) => item.id}
                    canCreate={canAddCustom}
                    onCreateClick={() => setIsItemDialogOpen(true)}
                    createLabel="Create"
                  />
                </div>
              ) : (
                <Button type="button" size="sm" onClick={() => setIsAddingItem(true)}>+ Add item</Button>
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
                    <div key={`${skill.id}-${skillIndex}`} className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{skill.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{skill.type}</p>
                        </div>
                        <button type="button" className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100" onClick={() => handleRemoveSkill(skillIndex)}>x</button>
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
                    onBlur={() => { setIsAddingSkill(false); setSkillQuery(""); }}
                    onSelectItem={handleAddSkill}
                    renderItem={(skill) => (<><span className="font-semibold">{skill.name}</span><span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{skill.type}</span></>)}
                    getItemKey={(skill) => skill.id}
                    canCreate={canAddCustom}
                    onCreateClick={() => setIsSkillDialogOpen(true)}
                    createLabel="Create"
                  />
                </div>
              ) : (
                <Button type="button" size="sm" onClick={() => setIsAddingSkill(true)}>+ Add skill</Button>
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
                    <div key={`${entry.id}-${specialIndex}`} className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold leading-tight">{entry.name}</p>
                          {entry.type ? <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{entry.type}</p> : null}
                        </div>
                        <button type="button" className="text-muted-foreground/70 opacity-0 transition group-hover:opacity-100" onClick={() => handleRemoveSpecial(specialIndex)}>x</button>
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
                    onBlur={() => { setIsAddingSpecial(false); setSpecialQuery(""); }}
                    onSelectItem={handleAddSpecial}
                    renderItem={(entry) => (<><span className="font-semibold">{entry.name}</span>{entry.type ? <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">{entry.type}</span> : null}</>)}
                    getItemKey={(entry) => entry.id}
                    canCreate={canAddCustom}
                    onCreateClick={() => setIsSpecialDialogOpen(true)}
                    createLabel="Create"
                  />
                </div>
              ) : (
                <Button type="button" size="sm" onClick={() => setIsAddingSpecial(true)}>+ Add special</Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
