import { useCallback, useState } from "react";
import { type QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateCatalogue } from "@/lib/catalogue-queries";
import { getRefusalMessage } from "@/lib/get-error-message";
import { queryKeys } from "@/lib/query-keys";

import { type EditorSave, getTemplateEditor, getTemplateWhoCan, makeTemplate } from "./editor-api";
import type { EditorAnswer, MakeTemplateInput } from "../types/editor-types";

const editorKey = (campaignId: number, templateId: number) =>
  [...queryKeys.campaign.warbandTemplate(campaignId, templateId), "editor"] as const;

/** The editor's read of one template (its facts and warnings with it). */
export function useTemplateEditor(campaignId: number, templateId: number | null) {
  return useQuery({
    queryKey: editorKey(campaignId, templateId ?? 0),
    queryFn: ({ signal }) => getTemplateEditor(templateId as number, campaignId, signal),
    enabled: templateId !== null && campaignId > 0,
  });
}

/** What the template's types can usually buy, read when the Lists section opens. */
export function useTemplateWhoCan(campaignId: number, templateId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.campaign.warbandTemplate(campaignId, templateId), "who-can"] as const,
    queryFn: ({ signal }) => getTemplateWhoCan(templateId, campaignId, signal),
    enabled: enabled && campaignId > 0,
    staleTime: 5 * 60_000,
  });
}

/**
 * After a template write (here, or another member's `catalogue.changed`): the Warbands page's
 * list and templates, the hire screens' templates and the raise outlines read again, and the
 * specials list (a save may write a template's own rule). Units on rosters never change.
 */
export function templatesChanged(
  queryClient: QueryClient,
  campaignId: number,
  { answered = false }: { answered?: boolean } = {}
) {
  const inCampaign = (key: readonly unknown[]) => key[0] === "campaign" && key[1] === campaignId;
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      inCampaign(queryKey) &&
      // the writer's own editor read is the answer it just cached
      !(answered && queryKey[4] === "editor") &&
      (queryKey[2] === "warband-templates" ||
        queryKey[2] === "raise-outline" ||
        (queryKey[2] === "warband" && queryKey[4] === "template")),
  });
}

/** An answer cached as the editor's read of its template (a house version's new id included). */
const remember = (queryClient: QueryClient, campaignId: number, answer: EditorAnswer) =>
  queryClient.setQueryData(editorKey(campaignId, answer.template.id), answer);

/**
 * One editor save at a time: the request, the answer cached under the template's id (which the
 * editor follows, `onSaved`), the stale reads, and a refusal kept to show beside the section.
 */
export function useEditorSave(
  campaignId: number,
  templateId: number,
  onSaved: (id: number) => void
) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(
    async (save: EditorSave) => {
      setPending(true);
      setError("");
      try {
        const answer = await save(templateId, campaignId);
        remember(queryClient, campaignId, answer);
        templatesChanged(queryClient, campaignId, { answered: true });
        void invalidateCatalogue(queryClient, "specials", campaignId);
        onSaved(answer.template.id);
        return answer;
      } catch (caught) {
        setError(getRefusalMessage(caught, "Unable to save"));
        return null;
      } finally {
        setPending(false);
      }
    },
    [campaignId, templateId, queryClient, onSaved]
  );
  return { run, pending, error, clearError: () => setError("") };
}

export type EditorSaveState = ReturnType<typeof useEditorSave>;

/** Make a template (blank or a copy); the answer is cached for the editor that opens on it. */
export function useMakeTemplate(campaignId: number) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const make = async (body: MakeTemplateInput) => {
    setPending(true);
    setError("");
    try {
      const answer = await makeTemplate(campaignId, body);
      remember(queryClient, campaignId, answer);
      templatesChanged(queryClient, campaignId, { answered: true });
      return answer;
    } catch (caught) {
      setError(getRefusalMessage(caught, "Unable to make the template"));
      return null;
    } finally {
      setPending(false);
    }
  };
  return { make, pending, error };
}
