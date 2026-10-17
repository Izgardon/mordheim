import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useMediaQuery } from "@/lib/use-media-query";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import { Checkbox } from "@components/checkbox";
import { Input } from "@components/input";
import { PageHeader } from "@components/page-header";
import MobileTabs from "@components/mobile-tabs";
import { TableSkeleton } from "@components/table-skeleton";

import {
  createCampaignLocation,
  listCampaignLocations,
  updateCampaignLocation,
} from "../api/campaigns-api";
import { useCampaignPermissions } from "@/features/campaigns/hooks/useCampaignQuery";
import { getCampaignSectionTabs, type CampaignSectionTabId } from "@/lib/campaign-section-tabs";
import LocationsTable from "../components/LocationsTable";

import type { CampaignLayoutContext } from "./CampaignLayout";
import type { CampaignLocation, CampaignLocationPayload } from "../types/campaign-types";

const emptyForm: CampaignLocationPayload = {
  name: "",
  content: "",
  d6_1: "",
  d6_2: "",
  d6_3: "",
  d6_4: "",
  d6_5: "",
  d6_6: "",
};

const d6FieldOrder = ["d6_1", "d6_2", "d6_3", "d6_4", "d6_5", "d6_6"] as const;
const LOCATION_ROW_BG_STYLE: CSSProperties = {};
const textareaClassName =
  "w-full border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-[0_12px_20px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_20px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

export default function Locations() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaign } = useOutletContext<CampaignLayoutContext>();
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [locations, setLocations] = useState<CampaignLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<CampaignLocation | null>(null);
  const [form, setForm] = useState<CampaignLocationPayload>(emptyForm);
  const [hasD6Results, setHasD6Results] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const campaignId = Number(id);
  const memberPermissions = useCampaignPermissions(campaignId);
  const campaignSectionTabs = useMemo(() => getCampaignSectionTabs(campaign), [campaign]);
  const canManage =
    campaign?.role === "owner" ||
    campaign?.role === "admin" ||
    memberPermissions.includes("manage_locations");
  const isEnabled = Boolean(campaign?.enable_locations);

  useEffect(() => {
    if (Number.isNaN(campaignId) || !isEnabled) {
      setLocations([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    listCampaignLocations(campaignId)
      .then((data) => setLocations(data))
      .catch((errorResponse) => {
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load locations.");
        } else {
          setError("Unable to load locations.");
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
    setEditingLocation(null);
    setForm(emptyForm);
    setHasD6Results(false);
    setFormError("");
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openEditForm = (location: CampaignLocation) => {
    setEditingLocation(location);
    setForm({
      name: location.name,
      content: location.content,
      d6_1: location.d6_1,
      d6_2: location.d6_2,
      d6_3: location.d6_3,
      d6_4: location.d6_4,
      d6_5: location.d6_5,
      d6_6: location.d6_6,
    });
    setHasD6Results(d6FieldOrder.some((fieldName) => Boolean(location[fieldName]?.trim())));
    setFormError("");
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeForm = () => {
    setEditingLocation(null);
    setForm(emptyForm);
    setHasD6Results(false);
    setFormError("");
    setIsFormOpen(false);
  };

  const handleSubmit = async () => {
    if (Number.isNaN(campaignId)) {
      return;
    }

    const payload: CampaignLocationPayload = {
      name: form.name?.trim() ?? "",
      content: form.content ?? "",
      d6_1: form.d6_1 ?? "",
      d6_2: form.d6_2 ?? "",
      d6_3: form.d6_3 ?? "",
      d6_4: form.d6_4 ?? "",
      d6_5: form.d6_5 ?? "",
      d6_6: form.d6_6 ?? "",
    };

    if (!payload.name) {
      setFormError("Name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      if (editingLocation) {
        const updated = await updateCampaignLocation(campaignId, editingLocation.id, payload);
        setLocations((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      } else {
        const created = await createCampaignLocation(campaignId, payload);
        setLocations((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      closeForm();
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFormError(errorResponse.message || "Unable to save location.");
      } else {
        setFormError("Unable to save location.");
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
      <PageHeader title="Locations" subtitle="Campaign trade and exploration locations" />

      {isMobile ? (
        <MobileTabs
          tabs={campaignSectionTabs}
          activeTab="locations"
          onTabChange={handleCampaignTabChange}
          className="mt-2"
          showDivider
        />
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-2 sm:gap-4 sm:px-0">
        {!isEnabled ? (
          <CardBackground className="rounded-2xl p-5">
            <p className="text-sm text-muted-foreground">
              Locations are currently disabled for this campaign. The campaign owner can enable them
              in Campaign Settings.
            </p>
          </CardBackground>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="theme-heading-soft text-xl font-bold">Campaign Locations</h3>
              </div>
              {canManage ? (
                <Button
                  size="sm"
                  className="md:h-11"
                  onClick={isFormOpen ? closeForm : openCreateForm}
                >
                  {isFormOpen ? "Close" : "Add location"}
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
                        placeholder="The Docks"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Main Content
                      </label>
                      <textarea
                        className={`${textareaClassName} min-h-[180px]`}
                        value={form.content ?? ""}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, content: event.target.value }))
                        }
                        placeholder="<p>Use paragraphs, bold, underline, and spacing as needed.</p>"
                      />
                      <p className="text-xs text-muted-foreground">
                        Rich text can be stored here as HTML-compatible content.
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 border border-border/60 bg-background/80 px-4 py-3 sm:col-span-2">
                      <div>
                        <p className="text-sm text-foreground">Use D6 results</p>
                        <p className="text-xs text-muted-foreground">
                          Add a roll table for this location.
                        </p>
                      </div>
                      <Checkbox
                        checked={hasD6Results}
                        onChange={(event) => setHasD6Results(event.target.checked)}
                        aria-label="Use D6 results"
                      />
                    </div>
                    {hasD6Results ? (
                      <div className="overflow-x-auto border border-border/60 bg-background/80 sm:col-span-2">
                        <table className="min-w-full text-sm">
                          <thead className="table-head-surface text-left text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            <tr>
                              <th className="w-20 px-3 py-2">Roll</th>
                              <th className="px-3 py-2">Result</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d6FieldOrder.map((fieldName, index) => (
                              <tr key={fieldName} className="border-t border-border/50 align-top">
                                <td className="px-3 py-2 font-semibold text-foreground">
                                  {index + 1}
                                </td>
                                <td className="px-3 py-2">
                                  <textarea
                                    className={`${textareaClassName} min-h-[90px]`}
                                    value={form[fieldName] ?? ""}
                                    onChange={(event) =>
                                      setForm((prev) => ({
                                        ...prev,
                                        [fieldName]: event.target.value,
                                      }))
                                    }
                                    placeholder={`Outcome for roll ${index + 1}`}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
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
                        {isSubmitting ? "Saving..." : editingLocation ? "Save changes" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-1 min-h-0 flex-col">
              {isLoading ? (
                <TableSkeleton columns={5} rows={10} />
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : locations.length === 0 ? (
                <CardBackground className="rounded-2xl p-5">
                  <p className="text-sm text-muted-foreground">No locations created yet.</p>
                </CardBackground>
              ) : (
                <LocationsTable
                  locations={locations}
                  rowBackground={LOCATION_ROW_BG_STYLE}
                  isMobile={isMobile}
                  renderActions={(location) =>
                    canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => openEditForm(location)}
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
