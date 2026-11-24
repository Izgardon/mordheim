import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import EditHouseRuleDialog from "../components/EditHouseRuleDialog";
import HouseRuleForm from "../components/HouseRuleForm";
import HouseRuleRow from "../components/HouseRuleRow";
import { useHouseRulesPage } from "../hooks/useHouseRulesPage";

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
            Add new
          </Button>
        ) : null
      }
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Search house rules"
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
      {/* while the first rule is being added the empty list says nothing */}
      {canManage && page.isFormOpen && !page.isLoading && !page.rules.length ? null : (
        <ReferenceList
          isEmpty={!page.isLoading && rows.length === 0}
          empty={page.rules.length ? "No house rules match." : "No house rules yet."}
        >
          {page.isLoading ? <ReferenceRowBones /> : null}
          {rows.map((rule) => {
            const key = String(rule.id);
            return (
              <HouseRuleRow
                key={key}
                rule={rule}
                open={params.isOpen(key)}
                onToggle={() => params.toggle(key)}
                onClose={params.close}
                isMobile={isMobile}
              >
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
              </HouseRuleRow>
            );
          })}
        </ReferenceList>
      )}
    </ReferencePage>
  );
}
