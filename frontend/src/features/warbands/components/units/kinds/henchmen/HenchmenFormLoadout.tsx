import { useMemo, useRef, useState } from "react";
import { Book, Shield, Star, Users, type LucideIcon } from "lucide-react";

import ItemFormDialog from "@/features/items/components/ItemFormDialog";
import SkillFormDialog from "@/features/skills/components/SkillFormDialog";
import CreateSpecialDialog from "@/features/special/components/CreateSpecialDialog";
import AcquireItemDialog from "@/features/items/components/AcquireItemDialog/AcquireItemDialog";
import { getPersistedItemCost } from "@/features/items/utils/acquire-item-costs";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { getLoadoutDropdownDisplayName } from "@/lib/loadout-display";
import { isPendingByType } from "../../../heroes/utils/pending-entries";
import AssignedEntries from "./AssignedEntries";
import HenchmenMemberList from "./HenchmenMemberList";
import { useHenchmenLoadoutEditing } from "./useHenchmenLoadoutEditing";

import type { Item } from "@/features/items/types/item-types";
import type { UnitFormSlotProps } from "../../forms/form-types";

type HenchmenLoadoutTab = "henchmen" | "items" | "skills" | "special";

const HENCHMEN_LOADOUT_TABS: { key: HenchmenLoadoutTab; label: string; icon: LucideIcon }[] = [
  { key: "henchmen", label: "Roster", icon: Users },
  { key: "items", label: "Items", icon: Shield },
  { key: "skills", label: "Skills", icon: Book },
  { key: "special", label: "Special", icon: Star },
];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** The group's loadout: Roster (members), Items, Skills and Specials tabs. */
export default function HenchmenFormLoadout(props: UnitFormSlotProps<"henchmen_group">) {
  const { form: group, index, campaignId, inputClassName, canAddCustom = false } = props;
  const { availableItems, availableSkills, availableSpecials } = props;
  const [activeTab, setActiveTab] = useState<HenchmenLoadoutTab>("henchmen");
  const [buyItemDialogOpen, setBuyItemDialogOpen] = useState(false);
  const [buyItemTarget, setBuyItemTarget] = useState<Item | null>(null);
  const draftGroupIdRef = useRef<string | null>(null);
  if (!draftGroupIdRef.current) {
    draftGroupIdRef.current = `draft-henchmen-${Date.now()}-${index}`;
  }
  const draftGroupId = group.draftKey ?? draftGroupIdRef.current;
  const draftUnit = !group.id
    ? {
        unitType: "henchmen" as const,
        id: draftGroupId,
        name: group.name ?? null,
        unit_type: group.unit_type ?? null,
      }
    : undefined;
  const editing = useHenchmenLoadoutEditing(props, (item) => {
    setBuyItemTarget(item);
    setBuyItemDialogOpen(true);
  });

  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((skill) => skill.type).filter(Boolean));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);
  const specialTypeOptions = useMemo(() => {
    const unique = new Set(availableSpecials.map((entry) => entry.type).filter(isNonEmptyString));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [availableSpecials]);
  const query = (value: string) => value.trim().toLowerCase();
  const matchingItems = availableItems.filter((item) =>
    matchesSearchQuery(query(editing.items.query), item.name, item.type)
  );
  const matchingSkills = availableSkills.filter((skill) =>
    matchesSearchQuery(query(editing.skills.query), skill.name, skill.type)
  );
  const matchingSpecials = availableSpecials.filter((entry) =>
    matchesSearchQuery(query(editing.specials.query), entry.name, entry.type)
  );

  return (
    <div className="space-y-1 overflow-visible rounded-md border border-border/60 bg-background/60 p-3">
      {canAddCustom && (
        <>
          <ItemFormDialog
            mode="create"
            campaignId={campaignId}
            onCreated={editing.handleCreatedItem}
            open={editing.items.isDialogOpen}
            onOpenChange={editing.items.setIsDialogOpen}
            trigger={null}
          />
          <SkillFormDialog
            mode="create"
            campaignId={campaignId}
            onCreated={editing.handleCreatedSkill}
            typeOptions={skillTypeOptions}
            open={editing.skills.isDialogOpen}
            onOpenChange={editing.skills.setIsDialogOpen}
            trigger={null}
          />
          <CreateSpecialDialog
            campaignId={campaignId}
            onCreated={editing.handleCreatedSpecial}
            typeOptions={specialTypeOptions}
            open={editing.specials.isDialogOpen}
            onOpenChange={editing.specials.setIsDialogOpen}
            trigger={null}
          />
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
          deferCommit={props.deferItemCommit}
          reservedGold={props.reservedGold}
          onPendingPurchaseAdd={props.onPendingPurchaseAdd}
          pendingPurchaseUnitId={group.id ?? draftGroupId}
          onAcquire={(item, resolvedUnitType, unitId, meta) => {
            const targetUnitId = group.id ? String(group.id) : (draftGroupId ?? "");
            if (resolvedUnitType === "henchmen" && targetUnitId === unitId) {
              const count = meta?.quantity ?? 1;
              const costStamped = { ...item, cost: getPersistedItemCost(item, meta) };
              for (let i = 0; i < count; i += 1) {
                editing.handleAddItem(costStamped);
              }
            }
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Loadout
        </p>
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/70 p-1">
          {HENCHMEN_LOADOUT_TABS.map(({ key, label, icon: Icon }) => {
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

      {activeTab === "henchmen" ? (
        <HenchmenMemberList
          {...props}
          stashQtyById={props.stashQtyById ?? {}}
          isUnitLimitReached={props.isUnitLimitReached ?? false}
        />
      ) : activeTab === "items" ? (
        <AssignedEntries
          title="Assigned items"
          entries={group.items}
          emptyMessage="No items assigned yet."
          gridClassName="grid grid-cols-3 gap-2"
          alwaysShowType
          onRemove={editing.handleRemoveItem}
          {...editing.items.search}
          addLabel="+ Add item"
          searchPlaceholder="Search items..."
          searchInputClassName={`${inputClassName} h-10 max-w-[400px]`}
          matches={matchingItems}
          onSelect={editing.handleSelectItem}
          renderMatch={(item) => (
            <>
              <span className="font-semibold">{item.name}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                {item.type}
              </span>
            </>
          )}
          canCreate={canAddCustom}
        />
      ) : activeTab === "skills" ? (
        <AssignedEntries
          title="Assigned skills"
          entries={group.skills.filter((s) => !isPendingByType(s))}
          emptyMessage="No skills assigned yet."
          gridClassName="grid grid-cols-2 gap-2"
          alwaysShowType
          onRemove={editing.handleRemoveSkill}
          {...editing.skills.search}
          addLabel="+ Add skill"
          searchPlaceholder="Search skills..."
          searchInputClassName={`${inputClassName} h-10`}
          matches={matchingSkills}
          onSelect={editing.handleAddSkill}
          renderMatch={(skill) => (
            <>
              <span className="font-semibold">{getLoadoutDropdownDisplayName(skill.name)}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                {skill.type}
              </span>
            </>
          )}
          canCreate={canAddCustom}
        />
      ) : (
        <AssignedEntries
          title="Assigned specials"
          entries={group.specials.filter((f) => !isPendingByType(f))}
          emptyMessage="No entries assigned yet."
          gridClassName="grid grid-cols-2 gap-2"
          onRemove={editing.handleRemoveSpecial}
          {...editing.specials.search}
          addLabel="+ Add special"
          searchPlaceholder="Search specials..."
          searchInputClassName={`${inputClassName} h-10`}
          matches={matchingSpecials}
          onSelect={editing.handleAddSpecial}
          renderMatch={(entry) => (
            <>
              <span className="font-semibold">{getLoadoutDropdownDisplayName(entry.name)}</span>
              {entry.type ? (
                <span className="text-[10px] uppercase tracking-[0.2em] text-accent/90">
                  {entry.type}
                </span>
              ) : null}
            </>
          )}
          canCreate={canAddCustom}
        />
      )}
    </div>
  );
}
