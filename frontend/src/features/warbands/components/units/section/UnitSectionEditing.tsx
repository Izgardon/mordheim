import { Button } from "@components/button";
import UnitFormCard from "../UnitFormCard";
import AddUnitForm from "../forms/AddUnitForm";
import { useWarbandCatalogue } from "../catalogue-context";
import { getWarbandMobileEditItemId } from "../../../hooks/warband/useWarbandMobileTopBar";

import type { UnitSectionEditor } from "../../../hooks/units/useUnitSectionEditor";
import type { UnitKindKey } from "../../../types/units";

/** Edit mode: one card per unit, the add form, and the "Add <unit>" button. */
export default function UnitSectionEditing<K extends UnitKindKey>({
  editor,
}: {
  editor: UnitSectionEditor<K>;
}) {
  const catalogue = useWarbandCatalogue();
  const { kind, forms, creation, limits, purchases, save, pendingEditFocus } = editor;
  const { AddFields } = kind.editor;

  return (
    <div className="space-y-5">
      {forms.forms.map((form, index) => (
        <div
          key={form.id ?? form.draftKey ?? `new-${index}`}
          id={getWarbandMobileEditItemId(
            kind.section,
            form.id ? `${kind.labels.formIdPrefix}-${form.id}` : `draft-${index}`
          )}
          className="scroll-mt-28"
        >
          <UnitFormCard
            kind={kind}
            form={form}
            index={index}
            campaignId={catalogue.campaignId}
            availableRaces={catalogue.availableRaces}
            availableItems={catalogue.availableItems}
            availableSkills={catalogue.availableSkills}
            availableSpells={catalogue.availableSpells}
            availableSpecials={catalogue.availableSpecials}
            canAddCustom={catalogue.canAddCustom}
            onRaceCreated={catalogue.onRaceCreated}
            onUpdate={forms.updateForm}
            onSetLeader={forms.setLeaderForm}
            onRemove={editor.removeForm}
            onSkillCreated={editor.addCreatedSkill}
            deferItemCommit
            reservedGold={purchases.pendingSpend}
            onPendingPurchaseAdd={purchases.addPendingPurchase}
            onPendingPurchaseRemove={purchases.removePendingPurchase}
            error={save.hasAttemptedSave ? kind.validate(form) : null}
            serverErrors={save.formErrors.get(form)}
            recruitCost={form.id ? undefined : kind.editor.creation.recruitCost(form)}
            onDuplicate={() => editor.duplicateForm(index)}
            duplicateBlockedReason={limits.duplicateBlockedReason(form)}
            initialTab={
              pendingEditFocus && form.id === pendingEditFocus.unitId
                ? pendingEditFocus.tab
                : undefined
            }
            isUnitLimitReached={limits.isUnitLimitReached}
            {...editor.formExtras}
          />
        </div>
      ))}
      {creation.isAdding ? (
        <AddUnitForm
          kind={kind}
          onCreate={creation.handleAdd}
          onCancel={() => {
            creation.setIsAdding(false);
            creation.setNewError("");
          }}
          error={creation.newError}
          notice={
            limits.addFormNotices.length > 0 ? (
              <>
                {limits.addFormNotices.map((notice) => (
                  <p key={notice} className="text-xs text-muted-foreground">
                    {notice}
                  </p>
                ))}
              </>
            ) : null
          }
        >
          <AddFields
            campaignId={catalogue.campaignId}
            form={creation.newForm}
            setForm={creation.setNewForm}
            setError={creation.setNewError}
            raceQuery={creation.raceQuery}
            setRaceQuery={creation.setRaceQuery}
            races={catalogue.availableRaces}
            onRaceCreated={catalogue.onRaceCreated}
            availableItems={catalogue.availableItems}
            availableSkills={catalogue.availableSkills}
            availableSpells={catalogue.availableSpells}
            availableSpecials={catalogue.availableSpecials}
            canAddCustom={catalogue.canAddCustom}
          />
        </AddUnitForm>
      ) : (
        <div
          id={getWarbandMobileEditItemId(kind.section, "add-new")}
          className={kind.addForm.buttonWrapperClassName}
        >
          <div className="flex justify-start">
            <Button
              type="button"
              onClick={() => {
                creation.setIsAdding(true);
                creation.setNewError("");
              }}
              disabled={limits.isAddDisabled}
            >
              {kind.labels.add}
            </Button>
          </div>
          {limits.addButtonNotice ? (
            <p className="text-xs text-muted-foreground">{limits.addButtonNotice}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
