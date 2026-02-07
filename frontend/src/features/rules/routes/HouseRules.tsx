import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { ListSkeleton } from "@components/card-skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Input } from "@components/input";
import { PageHeader } from "@components/page-header";

// api
import { listMyCampaignPermissions } from "../../campaigns/api/campaigns-api";
import { createHouseRule, listHouseRules } from "../api/rules-api";
import EditHouseRuleDialog from "../components/EditHouseRuleDialog";

// types
import type { CampaignLayoutContext } from "../../campaigns/routes/CampaignLayout";
import type { HouseRule, HouseRulePayload } from "../types/rule-types";

const initialForm: HouseRulePayload = {
  title: "",
  description: "",
};

export default function HouseRules() {
  const { id } = useParams();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [memberPermissions, setMemberPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<HouseRulePayload>(initialForm);
  const [open, setOpen] = useState(false);

  const campaignId = Number(id);

  const canManageRules = useMemo(() => {
    if (campaign?.role === "owner" || campaign?.role === "admin") {
      return true;
    }
    return memberPermissions.includes("manage_rules");
  }, [campaign?.role, memberPermissions]);

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

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialForm);
    }
  };

  const handleSubmit = async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createHouseRule(campaignId, {
        title: form.title.trim(),
        description: form.description.trim(),
      });
      setRules((prev) => [created, ...prev]);
      setOpen(false);
      setForm(initialForm);
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

  const handleUpdated = (updatedRule: HouseRule) => {
    setRules((prev) => prev.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule)));
  };

  const handleDeleted = (ruleId: number) => {
    setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  };

  return (
    <div className="min-h-0 space-y-6">
      <PageHeader title="House Rules" subtitle="Campaign-specific rulings" />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <CardBackground className="space-y-4 p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold" style={{ color: '#a78f79' }}>Rules Ledger</h3>
          {canManageRules ? (
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button>Add rule</Button>
              </DialogTrigger>
              <DialogContent className="max-w-[750px]">
                <DialogHeader>
                  <DialogTitle className="font-bold" style={{ color: '#a78f79' }}>New Rule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Title</label>
                    <Input
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Shared exploration loot"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Description</label>
                    <textarea
                      className="min-h-[140px] w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_22px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]"
                      value={form.description}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Describe the ruling and any clarifications."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSubmit} disabled={isSubmitting || !form.title.trim()}>
                    {isSubmitting ? "Saving..." : "Add rule"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No house rules logged yet.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-[0_12px_24px_rgba(5,20,24,0.3)]"
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
      </CardBackground>
    </div>
  );
}




