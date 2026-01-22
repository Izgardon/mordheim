import { useEffect, useMemo, useState } from "react";

// routing
import { useOutletContext, useParams } from "react-router-dom";

// components
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

// api
import { listAdminPermissions } from "../../campaigns/api/campaigns-api";
import { createHouseRule, listHouseRules } from "../api/rules-api";

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
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<HouseRulePayload>(initialForm);
  const [open, setOpen] = useState(false);

  const campaignId = Number(id);

  const canManageRules = useMemo(() => {
    if (campaign?.role === "owner") {
      return true;
    }
    if (campaign?.role === "admin") {
      return adminPermissions.includes("manage_rules");
    }
    return false;
  }, [campaign?.role, adminPermissions]);

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
    if (campaign?.role !== "admin" || Number.isNaN(campaignId)) {
      return;
    }

    listAdminPermissions(campaignId)
      .then((permissions) => setAdminPermissions(permissions.map((permission) => permission.code)))
      .catch(() => setAdminPermissions([]));
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

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            House rules
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">House rules</h1>
        </div>
        {canManageRules ? (
          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>Add rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New house rule</DialogTitle>
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
                    className="min-h-[140px] w-full rounded-md border-2 border-border/70 bg-background px-3 py-2 text-sm text-foreground shadow-[2px_2px_0_rgba(23,16,8,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Rules ledger</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Fetching rulings...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No house rules logged yet.</p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-lg border-2 border-border/70 bg-card/70 p-4 shadow-[3px_3px_0_rgba(23,16,8,0.2)]"
                >
                  <p className="text-sm font-semibold text-foreground">{rule.title}</p>
                  {rule.description ? (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                      {rule.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




