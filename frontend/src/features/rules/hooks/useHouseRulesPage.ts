import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

// api
import { createHouseRule } from "../api/rules-api";
import { useHouseRules } from "../api/rule-queries";
import { useCatalogueCache } from "@/lib/catalogue-queries";

// other
import { getErrorMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";
import { mergeAppliedRules } from "../utils/merge-applied-rules";

// types
import type { HouseRule, HouseRulePayload } from "../types/rule-types";

const EMPTY_FORM: HouseRulePayload = { title: "", description: "" };
const ITEM_EFFECT_KEYS = new Set(["half_price_armour", "improved_shields"]);
const NO_RULES: HouseRule[] = [];

/** The item-pricing effects a set of rules applies, as a comparable signature. */
export function itemEffectSignature(rules: HouseRule[]) {
  const keys = rules
    .map((rule) => rule.effect_key)
    .filter((key): key is string => !!key && ITEM_EFFECT_KEYS.has(key));
  return [...new Set(keys)].sort().join("|");
}

/**
 * House Rules: the cached rules, the new-rule form, and every write's answer put into the cached
 * list. When the item effects in play change, the cached item list is out of date (prices).
 */
export function useHouseRulesPage(campaignId: number) {
  const queryClient = useQueryClient();
  const catalogueCache = useCatalogueCache();
  const rulesQuery = useHouseRules(campaignId);
  const [form, setForm] = useState<HouseRulePayload>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const writeRules = (update: (rules: HouseRule[]) => HouseRule[]) => {
    const key = queryKeys.campaign.houseRules(campaignId);
    const previous = queryClient.getQueryData<HouseRule[]>(key) ?? NO_RULES;
    const next = update(previous);
    queryClient.setQueryData(key, next);
    if (itemEffectSignature(previous) === itemEffectSignature(next)) {
      return Promise.resolve();
    }
    return catalogueCache.invalidate("items", campaignId);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  const updateField = (field: keyof HouseRulePayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formError) {
      setFormError("");
    }
  };

  const submit = async () => {
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title || !description) {
      setFormError(title ? "Description is required." : "Title is required.");
      return;
    }
    setFormError("");
    setIsSubmitting(true);
    try {
      const created = await createHouseRule(campaignId, { title, description });
      await writeRules((rules) => [created, ...rules]);
      closeForm();
    } catch (errorResponse) {
      setActionError(getErrorMessage(errorResponse, "Unable to create house rule"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCommonRulesApplied = (applied: HouseRule[], { allApplied }: { allApplied: boolean }) => {
    void writeRules((rules) => mergeAppliedRules(rules, applied));
    if (allApplied) {
      closeForm();
    }
  };

  const loadError = rulesQuery.error
    ? getErrorMessage(rulesQuery.error, "Unable to load house rules")
    : "";

  return {
    rules: rulesQuery.data ?? NO_RULES,
    isLoading: rulesQuery.isPending,
    error: actionError || loadError,
    form,
    updateField,
    formError,
    isFormOpen,
    openForm: () => setIsFormOpen(true),
    closeForm,
    isSubmitting,
    submit,
    onCommonRulesApplied,
    onUpdated: (updated: HouseRule) =>
      void writeRules((rules) => rules.map((rule) => (rule.id === updated.id ? updated : rule))),
    onDeleted: (ruleId: number) =>
      void writeRules((rules) => rules.filter((rule) => rule.id !== ruleId)),
  };
}
