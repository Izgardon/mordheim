import { useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { campaignCapabilities } from "@/features/campaigns/capabilities";
import type { CampaignLayoutContext } from "@/features/campaigns/routes/CampaignLayout";
import ReferencePage from "@/features/reference/ReferencePage";
import { FilterRow, ReferenceSearch } from "@/features/reference/ReferenceFilters";
import { ReferenceList, ReferenceRow } from "@/features/reference/ReferenceList";
import { ReferenceRowBones } from "@/features/reference/ReferenceSkeleton";
import { useReferenceParams } from "@/features/reference/useReferenceParams";
import { getErrorMessage } from "@/lib/get-error-message";
import { matchesSearchQuery } from "@/lib/matches-search-query";
import { useMediaQuery } from "@/lib/use-media-query";

import { useCampaignRules } from "../api/rule-queries";
import CampaignRuleFields from "../components/CampaignRuleFields";
import EditCampaignRuleDialog from "../components/EditCampaignRuleDialog";
import { movedIds, useCampaignRuleWrites } from "../hooks/useCampaignRuleWrites";
import type { CampaignRulePayload } from "../types/rule-types";

const BLANK: CampaignRulePayload = { title: "", body: "" };

/**
 * Campaign rules (William, 7 Nov 2026: "campaign wide rules that are not house rules ... admin
 * only"): the campaign's own rulings in their order, searched by title or text, each row opening
 * to its text. Its owner and admins (`manage_campaign_rules`) add, edit, move and delete them.
 */
export default function CampaignRules() {
  const { id } = useParams();
  const campaignId = Number(id);
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const rules = useCampaignRules(campaignId);
  const writes = useCampaignRuleWrites(campaignId);
  const params = useReferenceParams(!rules.isPending);
  const canManage = campaignCapabilities(campaign).manage_campaign_rules;
  const [adding, setAdding] = useState<CampaignRulePayload | null>(null);
  const [error, setError] = useState("");
  const all = rules.data ?? [];
  const shown = all.filter(
    (rule) =>
      String(rule.id) === params.openId || matchesSearchQuery(params.query, rule.title, rule.body)
  );
  const onError = (fallback: string) => (failure: unknown) =>
    setError(getErrorMessage(failure, fallback));
  const add = () => {
    if (!adding?.title.trim()) return;
    setError("");
    writes.create.mutate(
      { title: adding.title.trim(), body: adding.body.trim() },
      {
        onSuccess: (rule) => {
          setAdding(null);
          params.reveal(String(rule.id));
        },
        onError: onError("Couldn't add the rule."),
      }
    );
  };
  const move = (ruleId: number, by: -1 | 1) =>
    writes.reorder.mutate(movedIds(all, ruleId, by), {
      onError: onError("Couldn't move the rule."),
    });

  return (
    <ReferencePage
      title="Campaign rules"
      section="campaign-rules"
      actions={
        canManage && !adding ? (
          <Button
            variant="secondary"
            className={isMobile ? "min-h-10" : undefined}
            onClick={() => setAdding(BLANK)}
          >
            {isMobile ? "Add" : "Add campaign rule"}
          </Button>
        ) : null
      }
      filters={
        <FilterRow isMobile={isMobile}>
          <ReferenceSearch
            value={params.query}
            onChange={params.setQuery}
            placeholder="Search campaign rules"
            label="Search the campaign rules"
            isMobile={isMobile}
          />
        </FilterRow>
      }
      summary={
        isMobile
          ? undefined
          : `${shown.length} ${shown.length === 1 ? "campaign rule" : "campaign rules"}`
      }
    >
      {error ? <p className="m-0 text-sm text-danger">{error}</p> : null}
      {canManage && adding ? (
        <form
          aria-label="Add a campaign rule"
          className="space-y-3 border border-accent-line bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <CampaignRuleFields value={adding} onChange={setAdding} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              type="submit"
              disabled={writes.create.isPending || !adding.title.trim()}
            >
              {writes.create.isPending ? "Saving…" : "Add rule"}
            </Button>
          </div>
        </form>
      ) : null}
      <ReferenceList
        isEmpty={!rules.isPending && shown.length === 0}
        empty={all.length ? "No campaign rules match." : "No campaign rules yet."}
      >
        {rules.isPending ? <ReferenceRowBones /> : null}
        {shown.map((rule) => {
          const key = String(rule.id);
          const place = all.findIndex((entry) => entry.id === rule.id);
          return (
            <ReferenceRow
              key={key}
              id={key}
              open={params.isOpen(key)}
              onToggle={() => params.toggle(key)}
              name={rule.title}
            >
              <div className={isMobile ? "flex flex-col gap-3" : "flex flex-col gap-3 px-3 pb-4"}>
                {rule.body ? (
                  <p className="m-0 whitespace-pre-line text-[13px] text-text2">{rule.body}</p>
                ) : null}
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <EditCampaignRuleDialog rule={rule} writes={writes} onDeleted={params.close} />
                    <Button
                      variant="ghost"
                      className="min-h-10"
                      disabled={place <= 0 || writes.reorder.isPending}
                      onClick={() => move(rule.id, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      variant="ghost"
                      className="min-h-10"
                      disabled={place >= all.length - 1 || writes.reorder.isPending}
                      onClick={() => move(rule.id, 1)}
                    >
                      Move down
                    </Button>
                  </div>
                ) : null}
              </div>
            </ReferenceRow>
          );
        })}
      </ReferenceList>
    </ReferencePage>
  );
}
