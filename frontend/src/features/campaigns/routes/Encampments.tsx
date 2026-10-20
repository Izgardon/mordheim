import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Input } from "@components/input";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";
import { TableSkeleton } from "@components/table-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import {
  createCampaignEncampment,
  listCampaignEncampments,
  listCampaignPlayerNames,
  updateCampaignEncampment,
} from "../api/campaigns-api";
import { campaignCapabilities } from "../capabilities";
import { getCampaignSectionTabs, type CampaignSectionTabId } from "@/lib/campaign-section-tabs";
import EncampmentsTable from "../components/EncampmentsTable";

import type { CampaignLayoutContext } from "./CampaignLayout";
import type {
  CampaignEncampment,
  CampaignEncampmentPayload,
  CampaignPlayerName,
} from "../types/campaign-types";

const UNASSIGNED_OWNER = "unassigned";
const ENCAMPMENT_ROW_BG_STYLE: CSSProperties = {};
const textareaClassName =
  "w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

export default function Encampments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [encampments, setEncampments] = useState<CampaignEncampment[]>([]);
  const [players, setPlayers] = useState<CampaignPlayerName[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEncampment, setEditingEncampment] = useState<CampaignEncampment | null>(null);
  const [form, setForm] = useState<CampaignEncampmentPayload>({
    name: "",
    owner_id: null,
    description: "",
  });
  const [ownerValue, setOwnerValue] = useState(UNASSIGNED_OWNER);
  const formRef = useRef<HTMLDivElement>(null);

  const campaignId = Number(id);
  const campaignSectionTabs = useMemo(() => getCampaignSectionTabs(campaign), [campaign]);
  const canManage = campaignCapabilities(campaign).manage_encampments;
  const isEnabled = Boolean(campaign?.enable_encampments);

  useEffect(() => {
    if (Number.isNaN(campaignId) || !isEnabled) {
      setEncampments([]);
      setPlayers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    Promise.all([listCampaignEncampments(campaignId), listCampaignPlayerNames(campaignId)])
      .then(([encampmentData, playerData]) => {
        setEncampments(encampmentData);
        setPlayers(playerData);
      })
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load encampments.");
        } else {
          setError("Unable to load encampments.");
        }
      })
      .finally(() => setIsLoading(false));
  }, [campaignId, isEnabled]);

  const handleCampaignTabChange = (tabId: CampaignSectionTabId) => {
    if (!id) {
      return;
    }
    navigate(`/campaigns/${id}/${tabId}`);
  };

  const openCreateForm = () => {
    setEditingEncampment(null);
    setForm({ name: "", owner_id: null, description: "" });
    setOwnerValue(UNASSIGNED_OWNER);
    setFormError("");
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openEditForm = (encampment: CampaignEncampment) => {
    setEditingEncampment(encampment);
    setForm({
      name: encampment.name,
      owner_id: encampment.owner_id,
      description: encampment.description,
    });
    setOwnerValue(encampment.owner_id ? String(encampment.owner_id) : UNASSIGNED_OWNER);
    setFormError("");
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeForm = () => {
    setEditingEncampment(null);
    setForm({ name: "", owner_id: null, description: "" });
    setOwnerValue(UNASSIGNED_OWNER);
    setFormError("");
    setIsFormOpen(false);
  };

  const handleSubmit = async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }

    const payload: CampaignEncampmentPayload = {
      name: form.name?.trim() ?? "",
      owner_id: ownerValue === UNASSIGNED_OWNER ? null : Number(ownerValue),
      description: form.description ?? "",
    };

    if (!payload.name) {
      setFormError("Name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      if (editingEncampment) {
        const updated = await updateCampaignEncampment(campaignId, editingEncampment.id, payload);
        setEncampments((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      } else {
        const created = await createCampaignEncampment(campaignId, payload);
        setEncampments((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      closeForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to save encampment.");
      } else {
        setFormError("Unable to save encampment.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!campaign) {
    return <p className="text-sm text-muted-foreground">No record of this campaign.</p>;
  }

  return (
    <div className="min-h-0 space-y-4 sm:space-y-6">
      <PageHeader title="Encampments" subtitle="Shared camps and ownership records" />

      {isMobile ? (
        <MobileTabs
          tabs={campaignSectionTabs}
          activeTab="encampments"
          onTabChange={handleCampaignTabChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 sm:gap-4 sm:px-0">
        {!isEnabled ? (
          <CardBackground className="rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">
              Encampments are currently disabled for this campaign. The campaign owner can enable
              them in Campaign Settings.
            </p>
          </CardBackground>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="theme-heading-soft text-xl font-bold">Campaign Encampments</h3>
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  className="md:h-11"
                  onClick={isFormOpen ? closeForm : openCreateForm}
                >
                  {isFormOpen ? "Close" : "Add encampment"}
                </Button>
              ) : null}
            </div>

            {isFormOpen ? (
              <div ref={formRef}>
                <div className="space-y-3 border border-border/60 bg-background/80 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="mb-1 block text-xs text-muted-foreground">Name</label>
                      <Input
                        value={form.name ?? ""}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        placeholder="Sailmakers' Row"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="mb-1 block text-xs text-muted-foreground">Owner</label>
                      <Select
                        value={ownerValue}
                        onValueChange={(value) => {
                          setOwnerValue(value);
                          setForm((prev) => ({
                            ...prev,
                            owner_id: value === UNASSIGNED_OWNER ? null : Number(value),
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an owner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED_OWNER}>Unassigned</SelectItem>
                          {players.map((player) => (
                            <SelectItem key={player.id} value={String(player.id)}>
                              {player.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Description
                      </label>
                      <textarea
                        className={`${textareaClassName} min-h-[150px]`}
                        value={form.description ?? ""}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="What does this encampment provide, protect, or connect to?"
                      />
                    </div>
                  </div>
                  {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={closeForm}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : editingEncampment ? "Save changes" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-1 min-h-0 flex-col">
              {isLoading ? (
                <TableSkeleton columns={4} rows={10} />
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : encampments.length === 0 ? (
                <CardBackground className="rounded-2xl p-5">
                  <p className="text-sm text-muted-foreground">No encampments created yet.</p>
                </CardBackground>
              ) : (
                <EncampmentsTable
                  encampments={encampments}
                  rowBackground={ENCAMPMENT_ROW_BG_STYLE}
                  isMobile={isMobile}
                  renderActions={(encampment) =>
                    canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => openEditForm(encampment)}
                      >
                        Edit
                      </Button>
                    ) : null
                  }
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
