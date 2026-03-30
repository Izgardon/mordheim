import { Button } from "@components/button";
import { Book, Shield, Sparkles, Star, type LucideIcon } from "lucide-react";
import ItemFormDialog from "../../../../items/components/ItemFormDialog";
import SkillFormDialog from "../../../../skills/components/SkillFormDialog";
import CreateSpellDialog from "../../../../spells/components/CreateSpellDialog";
import CreateSpecialDialog from "../../../../special/components/CreateSpecialDialog";
import AcquireItemDialog from "../../../../items/components/AcquireItemDialog/AcquireItemDialog";
import SearchableDropdown from "./SearchableDropdown";
import type { Item } from "../../../../items/types/item-types";
import type { Spell } from "../../../../spells/types/spell-types";
import type { Special } from "../../../../special/types/special-types";
import type { Skill } from "../../../../skills/types/skill-types";
import type { HeroFormEntry } from "../../../types/warband-types";
import type { UnitTypeOption } from "@components/unit-selection-section";
import type { PendingPurchase } from "@/features/warbands/utils/pending-purchases";
import { useUnitLoadout, isTraitSpecial } from "../../../hooks/shared/useUnitLoadout";
import { buildSpellCountMap, deduplicateSpells, getAdjustedSpellDc, getSpellDisplayName } from "../../../utils/spell-display";
import { getLoadoutDropdownDisplayName } from "@/lib/loadout-display";

type UnitLoadoutEntry = HeroFormEntry;
type LoadoutTab = "items" | "skills" | "spells" | "special";

const LOADOUT_TABS: { key: LoadoutTab; label: string; icon: LucideIcon }[] = [
  { key: "items", label: "Items", icon: Shield },
  { key: "skills", label: "Skills", icon: Book },
  { key: "spells", label: "Spells", icon: Sparkles },
  { key: "special", label: "Special", icon: Star },
];

type UnitLoadoutProps<T extends UnitLoadoutEntry> = {
  unit: T;
  index: number;
  campaignId: number;
  availableItems: Item[];
  availableSkills: Skill[];
  availableSpells: Spell[];
  availableSpecials: Special[];
  inputClassName: string;
  canAddCustom?: boolean;
  unitType?: UnitTypeOption;
  deferItemCommit?: boolean;
  reservedGold?: number;
  onPendingPurchaseAdd?: (purchase: PendingPurchase) => void;
  onPendingPurchaseRemove?: (match: { unitType: UnitTypeOption; unitId: string; itemId: number }) => void;
  onUpdate: (index: number, updater: (unit: T) => T) => void;
  onItemCreated: (index: number, item: Item) => void;
  onSkillCreated: (index: number, skill: Skill) => void;
  initialTab?: "items" | "skills" | "spells" | "special";
};

export default function UnitLoadout<T extends UnitLoadoutEntry>({
  unit,
  index,
  campaignId,
  availableItems,
  availableSkills,
  availableSpells,
  availableSpecials,
  inputClassName,
  canAddCustom = false,
  unitType,
  deferItemCommit = false,
  reservedGold = 0,
  onPendingPurchaseAdd,
  onPendingPurchaseRemove,
  onUpdate,
  onItemCreated,
  onSkillCreated,
  initialTab,
}: UnitLoadoutProps<T>) {
  const {
    activeTab,
    setActiveTab,
    isAddingItem,
    setIsAddingItem,
    itemQuery,
    setItemQuery,
    handleCloseItemSearch,
    isAddingSkill,
    setIsAddingSkill,
    skillQuery,
    setSkillQuery,
    handleCloseSkillSearch,
    isAddingSpell,
    setIsAddingSpell,
    spellQuery,
    setSpellQuery,
    handleCloseSpellSearch,
    isAddingSpecial,
    setIsAddingSpecial,
    specialQuery,
    setSpecialQuery,
    handleCloseSpecialSearch,
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
    draftUnitId,
    isCaster,
    matchingItems,
    matchingSkills,
    matchingSpells,
    matchingSpecials,
    skillTypeOptions,
    spellTypeOptions,
    specialTypeOptions,
    visibleSkills,
    visibleSpells,
    visibleSpecials,
    handleAddItem,
    handleSelectItem,
    handleRemoveItem,
    handleAddSkill,
    handleRemoveSkill,
    handleAddSpell,
    handleRemoveSpell,
    handleAddSpecial,
    handleRemoveSpecial,
    handleCreatedItem,
    handleCreatedSkill,
    handleCreatedSpell,
    handleCreatedSpecial,
  } = useUnitLoadout({
    unit,
    index,
    campaignId,
    availableItems,
    availableSkills,
    availableSpells,
    availableSpecials,
    unitType,
    deferItemCommit,
    onPendingPurchaseAdd,
    onPendingPurchaseRemove,
    onUpdate: onUpdate as (index: number, updater: (unit: HeroFormEntry) => HeroFormEntry) => void,
    onItemCreated,
    onSkillCreated,
    initialTab,
  });

  const isDraftUnit = !unit.id && Boolean(unitType);
  const spellCounts = buildSpellCountMap(visibleSpells);
  const deduplicatedSpells = deduplicateSpells(visibleSpells);
  const draftUnit = isDraftUnit && unitType
    ? {
        unitType,
        id: draftUnitId,
        name: unit.name ?? null,
        unit_type: unit.unit_type ?? null,
      }
    : undefined;

  return (
    <div className="space-y-1 overflow-visible rounded-xl border border-border/60 bg-background/60 p-3">
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
          variant="unit-edit"
          presetUnitType={unitType}
          presetUnitId={unit.id ?? draftUnitId ?? undefined}
          draftUnit={draftUnit}
          disableUnitSelection={Boolean(unitType)}
          defaultUnitSectionCollapsed={Boolean(unitType)}
          defaultRaritySectionCollapsed={false}
          defaultPriceSectionCollapsed={false}
          emitWarbandUpdate={false}
          deferCommit={deferItemCommit}
          reservedGold={reservedGold}
          onPendingPurchaseAdd={onPendingPurchaseAdd}
          pendingPurchaseUnitId={unit.id ?? undefined}
          onAcquire={(item, resolvedUnitType, unitId, meta) => {
            const targetUnitId = unit.id ? String(unit.id) : (draftUnitId ?? "");
            if (resolvedUnitType === unitType && targetUnitId === unitId) {
              const count = meta?.quantity ?? 1;
              const costStamped = { ...item, cost: meta?.isBuying ? ( meta.unitPrice) : item.cost ?? null };
              for (let i = 0; i < count; i += 1) {
                handleAddItem(costStamped);
              }
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Loadout</p>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1">
          {LOADOUT_TABS.filter((tab) => isCaster || tab.key !== "spells").map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                type="button"
                aria-label={label}
                aria-pressed={isActive}
                title={label}
                onClick={() => setActiveTab(key)}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-150",
                  isActive
                    ? "border-amber-300/80 bg-amber-300/15 text-amber-300/80 shadow-[0_0_0_1px_rgba(219,175,104,0.18)]"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-amber-300/70 hover:bg-background/80 hover:text-amber-300/70",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "items" ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Assigned items</p>
            <span className="text-xs text-muted-foreground">{unit.items.length}</span>
          </div>
          {unit.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items assigned yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {unit.items.map((item, itemIndex) => (
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
                      className="text-muted-foreground/70 transition lg:opacity-0 lg:group-hover:opacity-100"
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
            <div className="relative mt-2">
              <SearchableDropdown
                query={itemQuery}
                onQueryChange={setItemQuery}
                placeholder="Search items..."
                inputClassName={`${inputClassName} h-10 max-w-[400px]`}
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
              className="mt-2"
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
                      className="text-muted-foreground/70 transition lg:opacity-0 lg:group-hover:opacity-100"
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
            <div className="relative mt-2">
              <SearchableDropdown
                query={skillQuery}
                onQueryChange={setSkillQuery}
                placeholder="Search skills..."
                inputClassName={`${inputClassName} h-10`}
                items={matchingSkills}
                isOpen={true}
                onBlur={handleCloseSkillSearch}
                onSelectItem={handleAddSkill}
                renderItem={(skill) => (
                  <>
                    <span className="font-semibold">{getLoadoutDropdownDisplayName(skill.name)}</span>
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
            <Button type="button" size="sm" className="mt-2" onClick={() => setIsAddingSkill(true)}>
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
              {deduplicatedSpells.map((spell, spellIndex) => {
                const displayName = getSpellDisplayName(spell, spellCounts);
                const displayDc = getAdjustedSpellDc(spell.dc, spell, spellCounts);
                return (
                <div
                  key={`${spell.id}-${spellIndex}`}
                  className="group rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{displayName}</p>
                      {spell.type ? (
                        <p className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                          {spell.type}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {displayDc !== undefined && displayDc !== null && displayDc !== "" ? (
                        <span className="whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                          DC {displayDc}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="text-muted-foreground/70 transition lg:opacity-0 lg:group-hover:opacity-100"
                        onClick={() => handleRemoveSpell(spellIndex)}
                      >
                        x
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {isAddingSpell ? (
            <div className="relative mt-2">
              <SearchableDropdown
                query={spellQuery}
                onQueryChange={setSpellQuery}
                placeholder="Search spells..."
                inputClassName={`${inputClassName} h-10`}
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
            <Button type="button" size="sm" className="mt-2" onClick={() => setIsAddingSpell(true)}>
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
                    {isTraitSpecial(entry.name, unit.caster) ? null : (
                      <button
                        type="button"
                        className="text-muted-foreground/70 transition lg:opacity-0 lg:group-hover:opacity-100"
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
            <div className="relative mt-2">
              <SearchableDropdown
                query={specialQuery}
                onQueryChange={setSpecialQuery}
                placeholder="Search specials..."
                inputClassName={`${inputClassName} h-10`}
                items={matchingSpecials}
                isOpen={true}
                onBlur={handleCloseSpecialSearch}
                onSelectItem={handleAddSpecial}
                renderItem={(entry) => (
                  <>
                    <span className="font-semibold">{getLoadoutDropdownDisplayName(entry.name)}</span>
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
            <Button type="button" size="sm" className="mt-2" onClick={() => setIsAddingSpecial(true)}>
              + Add special
            </Button>
          )}
        </>
      )}
    </div>
  );
}
