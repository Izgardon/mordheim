import { useState } from "react";

import RulesSection from "@/features/rules/components/RulesSection";
import { useCampaignRuleWrites } from "@/features/rules/hooks/useCampaignRuleWrites";
import type { CampaignRule } from "@/features/rules/types/rule-types";

import { useEncampmentRuleStore } from "../api/encampment-queries";

/**
 * How the campaign's encampments are held, first on the page: its encampment rules, each row
 * opening its own modal as on the Campaign rules page. Its owner and admins
 * (`manage_campaign_rules`) add, edit, move and delete them; left out for a reader when there are
 * none.
 */
export default function EncampmentRules({
  campaignId,
  rules,
  loading,
  canManage,
  isMobile,
}: {
  campaignId: number;
  rules: CampaignRule[];
  loading: boolean;
  canManage: boolean;
  isMobile: boolean;
}) {
  const writes = useCampaignRuleWrites(campaignId, useEncampmentRuleStore(campaignId));
  const [openKey, setOpenKey] = useState<string | null>(null);
  if (!loading && !rules.length && !canManage) return null;
  return (
    <RulesSection
      title="Encampment rules"
      kind="encampment"
      rules={rules}
      loading={loading}
      query=""
      canManage={canManage}
      writes={writes}
      openKey={openKey}
      onOpen={setOpenKey}
      onClose={() => setOpenKey(null)}
      isMobile={isMobile}
    />
  );
}
