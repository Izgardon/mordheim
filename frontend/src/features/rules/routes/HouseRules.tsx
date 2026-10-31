import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import RulesPanel from "@/features/warbands/components/roster/RulesPanel";
import { ruleLabel } from "@/features/catalogue/utils/entry-status";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import EditHouseRuleDialog from "../components/EditHouseRuleDialog";
import HouseRuleForm from "../components/HouseRuleForm";
import { useHouseRulesPage } from "../hooks/useHouseRulesPage";
import type { HouseRule } from "../types/rule-types";

/** "Changes the game" for a rule with an effect, else plain "House rule". */
const kindOf = (rule: HouseRule) =>
  rule.effect_key ? `House rule · ${ruleLabel(rule.effect_key)}` : "House rule";

/**
 * House rules (design E's reference layout): the campaign's rulings, searched by title or text,
 * each row opening to its text in the warband page's rules panel. Whoever manages the rules today
 * (`manage_rules`) adds one (or picks common ones), edits and deletes them.
 */
export default function HouseRules() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const page = useHouseRulesPage(campaignId);
  const params = useReferenceParams(!page.isLoading);
  const canManage = campaignCapabilities(campaign).manage_rules;
  const rows = page.rules.filter(
    (rule) =>
      String(rule.id) === params.openId ||
      matchesSearchQuery(params.query, rule.title, rule.description)
  );

  return (
    <ReferencePage
      title="House rules"
      section="house-rules"
      actions={
        canManage && !page.isFormOpen ? (
          <Button
            variant="secondary"
            className={isMobile ? "min-h-10" : undefined}
            onClick={page.openForm}
          >
            {isMobile ? "Add" : "Add house rule"}
          </Button>
        ) : null
      }
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Title or text"
            label="Search the house rules"
            isMobile={isMobile}
          />
        </FilterRow>
      }
      summary={
        isMobile
          ? undefined
          : `${rows.length} ${rows.length === 1 ? "house rule" : "house rules"} in this campaign`
      }
    >
      {page.error ? <p className="m-0 text-sm text-danger">{page.error}</p> : null}
      {canManage && page.isFormOpen ? (
        <HouseRuleForm
          campaignId={campaignId}
          rules={page.rules}
          form={page.form}
          onFieldChange={page.updateField}
          formError={page.formError}
          isSubmitting={page.isSubmitting}
          onCancel={page.closeForm}
          onSubmit={() => void page.submit()}
          onCommonRulesApplied={page.onCommonRulesApplied}
        />
      ) : null}
      <ReferenceList
        isEmpty={!page.isLoading && rows.length === 0}
        empty={
          page.rules.length
            ? "No house rules match. Try another word."
            : "No house rules yet: this campaign plays by the book."
        }
      >
        {page.isLoading ? <ReferenceRowBones /> : null}
        {rows.map((rule) => {
          const key = String(rule.id);
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={rule.title}
              sub={kindOf(rule)}
            >
              <div className={isMobile ? "flex flex-col gap-2" : "flex flex-col gap-2 px-3 pb-4"}>
                <RulesPanel
                  detail={{ name: rule.title, kind: kindOf(rule), text: rule.description }}
                  onClose={params.close}
                />
                {canManage ? (
                  <EditHouseRuleDialog
                    campaignId={campaignId}
                    rule={rule}
                    onUpdated={page.onUpdated}
                    onDeleted={(ruleId) => {
                      page.onDeleted(ruleId);
                      params.close();
                    }}
                    trigger={
                      <Button variant="secondary" className="min-h-10 self-start">
                        Edit house rule
                      </Button>
                    }
                  />
                ) : null}
              </div>
            </ReferenceRow>
          );
        })}
      </ReferenceList>
    </ReferencePage>
  );
}
