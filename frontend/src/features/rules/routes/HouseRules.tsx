import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/app-store";

// routing
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";
import { House, ScrollText } from "lucide-react";

// components
import { Button } from "@components/button";
import { ListSkeleton } from "@components/card-skeleton";
import { Input } from "@components/input";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";

// api
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";
import { createHouseRule, listHouseRules } from "../api/rules-api";
import CommonRulesSheet from "../components/CommonRulesSheet";
import EditHouseRuleDialog from "../components/EditHouseRuleDialog";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { HouseRule, HouseRulePayload } from "../types/rule-types";

const initialForm: HouseRulePayload = {
  title: "",
  description: "",
};

const rulesNavTabs = [
  { id: "rules", label: "Rules", icon: ScrollText },
  { id: "house-rules", label: "House Rules", icon: House },
] as const;

export default function HouseRules() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign, lookups } = useOutletContext<CampaignLayoutContext>();
  const { setItemsCache } = useAppStore();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<HouseRulePayload>(initialForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCommonRulesOpen, setIsCommonRulesOpen] = useState(false);

  const campaignId = Number(id);
  const campaignKey = Number.isNaN(campaignId) ? "base" : `campaign:${campaignId}`;

  const canManageRules = useMemo(() => {
    if (campaign?.role === "owner" || campaign?.role === "admin") {
      return true;
    }
    return memberPermissions.includes("manage_rules");
  }, [campaign?.role, memberPermissions]);

  const syncItemCatalogIfNeeded = async (previousRules: HouseRule[], nextRules: HouseRule[]) => {
    const itemEffectKeys = new Set(["half_price_armour", "improved_shields"]);
    const previousKeys = previousRules
      .map((rule) => rule.effect_key)
      .filter((value): value is string => Boolean(value) && itemEffectKeys.has(value));
    const nextKeys = nextRules
      .map((rule) => rule.effect_key)
      .filter((value): value is string => Boolean(value) && itemEffectKeys.has(value));

    const previousSignature = [...new Set(previousKeys)].sort().join("|");
    const nextSignature = [...new Set(nextKeys)].sort().join("|");

    if (previousSignature === nextSignature || Number.isNaN(campaignId)) {
      return;
    }

    const refreshedItems = await lookups.loadItems();
    setItemsCache(campaignKey, refreshedItems);
  };

  useEffect(() => {
    if (Number.isNaN(campaignId)) {
      return;
    }

    setIsLoading(true);
    setError("");

    listHouseRules(campaignId)
      .then((data) => setRules(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load house rules");
        } else {
          setError("Unable to load house rules");
        }
      })
      .finally(() => setIsLoading(false));
  }, [campaignId]);

  useEffect(() => {
    if (campaign?.role !== "player" || Number.isNaN(campaignId)) {
      return;
    }

    listMyCampaignPermissions(campaignId)
      .then((permissions) => setMemberPermissions(permissions.map((permission) => permission.code)))
      .catch(() => setMemberPermissions([]));
  }, [campaign?.role, campaignId]);

  const handleSubmit = async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();

    if (!title) {
      setFormError("Title is required.");
      return;
    }

    if (!description) {
      setFormError("Description is required.");
      return;
    }

    setFormError("");
    setIsSubmitting(true);

    try {
      const created = await createHouseRule(campaignId, {
        title,
        description,
      });
      const nextRules = [created, ...rules];
      setRules(nextRules);
      await syncItemCatalogIfNeeded(rules, nextRules);
      setIsFormOpen(false);
      setForm(initialForm);
      setFormError("");
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to create house rule");
      } else {
        setError("Unable to create house rule");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setForm(initialForm);
    setFormError("");
  };

  const handleUpdated = (updatedRule: HouseRule) => {
    const nextRules = rules.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule));
    setRules(nextRules);
    void syncItemCatalogIfNeeded(rules, nextRules);
  };

  const handleDeleted = (ruleId: number) => {
    const nextRules = rules.filter((rule) => rule.id !== ruleId);
    setRules(nextRules);
    void syncItemCatalogIfNeeded(rules, nextRules);
  };

  const handleCommonRulesApplied = (createdRules: HouseRule[]) => {
    const nextRules = [...createdRules, ...rules];
    setRules(nextRules);
    void syncItemCatalogIfNeeded(rules, nextRules);
    setIsFormOpen(false);
    setForm(initialForm);
    setFormError("");
  };

  const handleRulesNavChange = (tabId: (typeof rulesNavTabs)[number]["id"]) => {
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
          tabs={rulesNavTabs}
          activeTab="house-rules"
          onTabChange={handleRulesNavChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-4 px-2 sm:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="theme-heading-soft text-xl font-bold">Rules Ledger</h3>
          {canManageRules && !isFormOpen ? (
            <Button size="sm" onClick={() => setIsFormOpen(true)}>
              Add rule
            </Button>
          ) : null}
        </div>
        {canManageRules && isFormOpen ? (
          <div className="surface-panel-strong space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="theme-heading-soft text-sm font-semibold uppercase tracking-[0.2em]">
                New Rule
              </h4>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsCommonRulesOpen(true)}
                disabled={isSubmitting}
              >
                Common Rules
              </Button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, title: event.target.value }));
                    if (formError) {
                      setFormError("");
                    }
                  }}
                  placeholder="Parry changes"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Description</label>
                <textarea
                  className="field-surface min-h-[140px] w-full rounded-2xl px-3 py-2 text-sm text-foreground shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  value={form.description}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, description: event.target.value }));
                    if (formError) {
                      setFormError("");
                    }
                  }}
                  placeholder="Describe the ruling and any clarifications."
                />
              </div>
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Add rule"}
              </Button>
            </div>
            <CommonRulesSheet
              campaignId={campaignId}
              existingRules={rules}
              open={isCommonRulesOpen}
              onOpenChange={setIsCommonRulesOpen}
              onApplied={handleCommonRulesApplied}
            />
          </div>
        ) : null}
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No house rules logged yet.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="surface-panel-strong rounded-2xl p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{rule.title}</p>
                  {canManageRules ? (
                    <EditHouseRuleDialog
                      campaignId={campaignId}
                      rule={rule}
                      onUpdated={handleUpdated}
                      onDeleted={handleDeleted}
                    />
                  ) : null}
                </div>
                {rule.description ? (
                  <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                    {rule.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




