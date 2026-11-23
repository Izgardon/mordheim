import { useOutletContext, useParams } from "react-router-dom";

import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMediaQuery } from "@/lib/use-media-query";

import { useCampaignCharts, useCampaignRules } from "../api/rule-queries";
import ChartsSection from "../components/ChartsSection";
import RulesSection from "../components/RulesSection";
import { useCampaignChartWrites } from "../hooks/useCampaignChartWrites";
import { useCampaignRulesTitle } from "../hooks/useCampaignRulesTitle";
import { useCampaignRuleWrites } from "../hooks/useCampaignRuleWrites";

/**
 * Campaign rules (William, 7 Nov 2026: "campaign wide rules that are not house rules ... admin
 * only"): three lists on one page (William, 19 Nov 2026) — the campaign's own rules, its battle
 * rules and its charts. Every row opens its own modal, and the rules or charts sharing an umbrella
 * are one row that opens them together. Its owner and admins (`manage_campaign_rules`) add, edit,
 * move and delete all three.
 */
export default function CampaignRules() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const rules = useCampaignRules(campaignId);
  const charts = useCampaignCharts(campaignId);
  const ruleWrites = useCampaignRuleWrites(campaignId);
  const chartWrites = useCampaignChartWrites(campaignId);
  const params = useReferenceParams(!rules.isPending && !charts.isPending);
  const canManage = campaignCapabilities(campaign).manage_campaign_rules;
  const title = useCampaignRulesTitle(campaign?.preset_id);
  const allRules = rules.data ?? [];
  const allCharts = charts.data ?? [];
  const failure = rules.error || charts.error ? getErrorMessage(rules.error ?? charts.error) : "";
  const lists = {
    query: params.query,
    canManage,
    openKey: params.openId,
    onOpen: (key: string) => params.reveal(key),
    onClose: params.close,
    isMobile,
  };

  return (
    <ReferencePage
      title={title}
      section="campaign-rules"
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Search the rules and tables"
            label="Search the campaign rules, battle rules and tables"
            isMobile={isMobile}
          />
        </FilterRow>
      }
    >
      {failure ? <p className="m-0 text-sm text-danger">{failure}</p> : null}
      <div className="flex flex-col gap-8">
        <RulesSection
          title="Campaign rules"
          kind="campaign"
          rules={allRules}
          loading={rules.isPending}
          writes={ruleWrites}
          {...lists}
        />
        <RulesSection
          title="Battle rules"
          kind="battle"
          rules={allRules}
          loading={rules.isPending}
          writes={ruleWrites}
          {...lists}
        />
        <ChartsSection
          charts={allCharts}
          loading={charts.isPending}
          writes={chartWrites}
          {...lists}
        />
      </div>
    </ReferencePage>
  );
}
