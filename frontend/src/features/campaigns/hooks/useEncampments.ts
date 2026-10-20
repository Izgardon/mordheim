import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import {
  createCampaignEncampment,
  deleteCampaignEncampment,
  updateCampaignEncampment,
} from "../api/campaigns-api";
import {
  updateCachedList,
  useCampaignEncampments,
  useCampaignPlayerNames,
} from "../api/campaign-queries";

// other
import { isArchived } from "../capabilities";
import { useAppStore } from "@/stores/app-store";
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

// types
import type {
  CampaignEncampment,
  CampaignEncampmentPayload,
  CampaignPlayerName,
  CampaignSummary,
} from "../types/campaign-types";

/** The owner picker's value for an encampment nobody owns (`owner_id: null`). */
export const NOBODY_OWNER = "nobody";

const NO_ENCAMPMENTS: CampaignEncampment[] = [];
const NO_PLAYERS: CampaignPlayerName[] = [];
const EMPTY_FORM: CampaignEncampmentPayload = { name: "", owner_id: null, description: "" };

const byName = (a: CampaignEncampment, b: CampaignEncampment) => a.name.localeCompare(b.name);

/**
 * The Encampments page (decision 9, CAMP-TWEAK-08): the cached encampments and members' names
 * (read only while the page is on), any member's Add with themselves as the default owner, and
 * each row's Edit and Delete as its `capabilities.edit` says. Answers go into the cached list.
 */
export function useEncampments(campaign: CampaignSummary) {
  const campaignId = campaign.id;
  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const myOwnerValue = user?.id ? String(user.id) : NOBODY_OWNER;
  const isEnabled = Boolean(campaign.enable_encampments);
  const encampments = useCampaignEncampments(campaignId, { enabled: isEnabled });
  const players = useCampaignPlayerNames(campaignId, { enabled: isEnabled });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignEncampment | null>(null);
  const [form, setForm] = useState<CampaignEncampmentPayload>(EMPTY_FORM);
  const [ownerValue, setOwnerValue] = useState(myOwnerValue);
  const [deleting, setDeleting] = useState<CampaignEncampment | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const loadError = encampments.error ?? players.error;

  const openForm = (encampment: CampaignEncampment | null) => {
    setEditing(encampment);
    setForm(
      encampment
        ? {
            name: encampment.name,
            owner_id: encampment.owner_id,
            description: encampment.description,
          }
        : EMPTY_FORM
    );
    setOwnerValue(
      encampment ? (encampment.owner_id ? String(encampment.owner_id) : NOBODY_OWNER) : myOwnerValue
    );
    setFormError("");
    setIsFormOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOwnerValue(myOwnerValue);
    setFormError("");
    setIsFormOpen(false);
  };

  const chooseOwner = (value: string) => {
    setOwnerValue(value);
    setForm((prev) => ({ ...prev, owner_id: value === NOBODY_OWNER ? null : Number(value) }));
  };

  const submit = async () => {
    const payload: CampaignEncampmentPayload = {
      name: form.name?.trim() ?? "",
      owner_id: ownerValue === NOBODY_OWNER ? null : Number(ownerValue),
      description: form.description ?? "",
    };
    if (!payload.name) {
      setFormError("Name is required.");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    const listKey = queryKeys.campaign.encampments(campaignId);
    try {
      if (editing) {
        const updated = await updateCampaignEncampment(campaignId, editing.id, payload);
        updateCachedList<CampaignEncampment>(queryClient, listKey, (prev) =>
          prev.map((entry) => (entry.id === updated.id ? updated : entry))
        );
      } else {
        const created = await createCampaignEncampment(campaignId, payload);
        updateCachedList<CampaignEncampment>(queryClient, listKey, (prev) =>
          [...prev, created].sort(byName)
        );
      }
      closeForm();
    } catch (errorResponse) {
      setFormError(getErrorMessage(errorResponse, "Unable to save encampment."));
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Soft: the server hides it, so it leaves the list (CAMP-TWEAK-08). */
  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }
    setIsDeleting(true);
    setDeleteError("");
    try {
      await deleteCampaignEncampment(campaignId, deleting.id);
      updateCachedList<CampaignEncampment>(
        queryClient,
        queryKeys.campaign.encampments(campaignId),
        (prev) => prev.filter((entry) => entry.id !== deleting.id)
      );
      setDeleting(null);
    } catch (errorResponse) {
      setDeleteError(getErrorMessage(errorResponse, "Unable to delete the encampment."));
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isEnabled,
    // Any member adds one while the page is on, and the campaign isn't archived.
    canAdd: !isArchived(campaign),
    deleting,
    deleteError,
    isDeleting,
    requestDelete: (encampment: CampaignEncampment) => {
      setDeleteError("");
      setDeleting(encampment);
    },
    cancelDelete: () => setDeleting(null),
    confirmDelete,
    encampments: encampments.data ?? NO_ENCAMPMENTS,
    players: players.data ?? NO_PLAYERS,
    isLoading: isEnabled && (encampments.isPending || players.isPending) && !loadError,
    error: loadError ? getErrorMessage(loadError, "Unable to load encampments.") : "",
    isFormOpen,
    editing,
    form,
    setForm,
    ownerValue,
    chooseOwner,
    formError,
    isSubmitting,
    formRef,
    openCreateForm: () => openForm(null),
    openEditForm: (encampment: CampaignEncampment) => openForm(encampment),
    closeForm,
    submit,
  };
}
