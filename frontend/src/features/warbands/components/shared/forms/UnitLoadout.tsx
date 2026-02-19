import { Button } from "@components/button";
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
import { buildSpellCountMap, getAdjustedSpellDc, getSpellDisplayName } from "../../../utils/spell-display";

type UnitLoadoutEntry = HeroFormEntry;

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
  const draftUnit = isDraftUnit && unitType
    ? {
        unitType,
        id: draftUnitId,
        name: unit.name ?? null,
        unit_type: unit.unit_type ?? null,
      }
    : undefined;

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
          onAcquire={(item, resolvedUnitType, unitId, meta) => {
            const targetUnitId = unit.id ? String(unit.id) : (draftUnitId ?? "");
            if (resolvedUnitType === unitType && targetUnitId === unitId) {
              const count = meta?.quantity ?? 1;
              for (let i = 0; i < count; i += 1) {
                handleAddItem(item);
              }
              if (deferItemCommit && unitType && unit.id && meta && onPendingPurchaseAdd) {
                onPendingPurchaseAdd({
                  unitType,
                  unitId: String(unit.id),
                  itemId: item.id,
                  itemName: item.name,
                  quantity: Math.max(1, meta.quantity),
                  unitPrice: Math.max(0, meta.unitPrice),
                  isBuying: meta.isBuying,
                  reason: meta.reason,
                });
              }
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Loadout</p>
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
            <span className="text-xs text-muted-foreground">{unit.items.length}</span>
          </div>
          {unit.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items assigned yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
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
            <div className="relative">
              <SearchableDropdown
                query={itemQuery}
                onQueryChange={setItemQuery}
                placeholder="Search items..."
                inputClassName={`${inputClassName} h-12 max-w-[400px]`}
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
              {visibleSpells.map((spell, spellIndex) => {
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
