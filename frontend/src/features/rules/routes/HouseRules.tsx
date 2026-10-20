import { useMemo } from "react";

// routing
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

// components
import { Button } from "@components/button";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";
import HouseRuleForm from "../components/HouseRuleForm";
import HouseRuleList from "../components/HouseRuleList";

// hooks
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import { getCampaignSectionTabs, type CampaignSectionTabId } from "@/lib/campaign-section-tabs";
import { useHouseRulesPage } from "../hooks/useHouseRulesPage";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";

export default function HouseRules() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const campaignSectionTabs = useMemo(() => getCampaignSectionTabs(campaign), [campaign]);
  const campaignId = Number(id);
  const page = useHouseRulesPage(campaignId);
  const canManageRules = campaignCapabilities(campaign).manage_rules;

  const handleRulesNavChange = (tabId: CampaignSectionTabId) => {
    if (!id) {
      return;
    }
    navigate(`/campaigns/${id}/${tabId}`);
  };

  return (
    <div className="min-h-0 space-y-4 sm:space-y-6">
      <PageHeader title="House Rules" subtitle="Campaign-specific rulings" />

      {isMobile ? (
        <MobileTabs
          tabs={campaignSectionTabs}
          activeTab="house-rules"
          onTabChange={handleRulesNavChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      {page.error ? <p className="text-sm text-red-600">{page.error}</p> : null}

      <div className="space-y-4 px-2 sm:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="theme-heading-soft text-xl font-bold">Rules Ledger</h3>
          {canManageRules && !page.isFormOpen ? (
            <Button size="sm" onClick={page.openForm}>
              Add rule
            </Button>
          ) : null}
        </div>
        {canManageRules && page.isFormOpen ? (
          <HouseRuleForm
            campaignId={campaignId}
            rules={page.rules}
            form={page.form}
            onFieldChange={page.updateField}
            formError={page.formError}
            isSubmitting={page.isSubmitting}
            onCancel={page.closeForm}
            onSubmit={page.submit}
            onCommonRulesApplied={page.onCommonRulesApplied}
          />
        ) : null}
        <HouseRuleList
          campaignId={campaignId}
          rules={page.rules}
          isLoading={page.isLoading}
          canManageRules={canManageRules}
          onUpdated={page.onUpdated}
          onDeleted={page.onDeleted}
        />
      </div>
    </div>
  );
}
