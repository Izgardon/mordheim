import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deleteTemplate } from "@/features/warband-templates/api/editor-api";
import { templatesChanged } from "@/features/warband-templates/api/editor-queries";
import { deleteWarband } from "@/features/warbands/api/warbands-core";
import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

import {
  getWorkshop,
  importIntoWorkshop,
  listBookTemplates,
  listToWorkshop,
  makeWorkshopList,
  makeWorkshopWarband,
  openWorkshop,
  previewSharedCode,
  warbandToWorkshop,
} from "./workshop-api";
import type {
  MadeInWorkshop,
  MakeListBody,
  MakeWarbandBody,
  WorkshopListRow,
} from "../types/workshop-types";
import { contentArrived } from "./content-arrived";

/** A code as the server reads it: case-blind, spaces and dashes ignored. */
export const cleanCode = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, "");

/** Codes are 8 characters: a preview is read once one is typed in full. */
export const CODE_LENGTH = 8;

/** My workshop (Home and the workshop's pages), read on every visit. */
export function useWorkshop() {
  return useQuery({
    queryKey: queryKeys.workshop(),
    queryFn: ({ signal }) => getWorkshop(signal),
    staleTime: 0,
  });
}

/** What a typed code shares, read once the code is whole (a miss is the server's 404). */
export function useSharedPreview(typed: string) {
  const code = cleanCode(typed);
  return useQuery({
    queryKey: queryKeys.sharedCode(code),
    queryFn: ({ signal }) => previewSharedCode(code, signal),
    enabled: code.length === CODE_LENGTH,
    retry: false,
    staleTime: 30_000,
  });
}

/** The book's templates (the type picker of a new workshop warband), reused like the catalogue. */
export function useBookTemplates(enabled = true) {
  return useQuery({
    queryKey: queryKeys.bookWarbandTemplates(),
    queryFn: ({ signal }) => listBookTemplates(signal),
    staleTime: CATALOGUE_STALE_TIME_MS,
    enabled,
  });
}

/** Every write into my workshop reads my workshop again (and its catalogue where content came). */
function useWorkshopMutation<T, R>(write: (body: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: (answer) => {
      const made = answer as Partial<MadeInWorkshop> | undefined;
      if (made?.campaign_id) contentArrived(queryClient, made.campaign_id, made.warnings);
      return queryClient.invalidateQueries({ queryKey: queryKeys.workshop() });
    },
  });
}

/** My workshop, made on its first use (My content before any warband or list): its answer cached. */
export function useOpenWorkshop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => openWorkshop(),
    onSuccess: (workshop) => queryClient.setQueryData(queryKeys.workshop(), workshop),
  });
}

export const useMakeWarband = () =>
  useWorkshopMutation((body: MakeWarbandBody) => makeWorkshopWarband(body));
export const useMakeList = () =>
  useWorkshopMutation((body: MakeListBody) => makeWorkshopList(body));
export const useImportIntoWorkshop = () =>
  useWorkshopMutation((code: string) => importIntoWorkshop(cleanCode(code)));
/** Copy to my workshop: my warband in a campaign. */
export const useWarbandToWorkshop = () =>
  useWorkshopMutation((warbandId: number) => warbandToWorkshop(warbandId));
/** Copy to my lists: a campaign's own list. */
export const useListToWorkshop = () =>
  useWorkshopMutation((templateId: number) => listToWorkshop(templateId));
/** A workshop warband's Delete (soft: its code stops working, copies stay). */
export const useDeleteWorkshopWarband = () =>
  useWorkshopMutation((warbandId: number) => deleteWarband(warbandId));

/** A list's Delete is the catalogue's (archived while a warband reads it); its code stops working. */
export function useDeleteWorkshopList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (row: WorkshopListRow) => deleteTemplate(row, row.campaign_id),
    onSuccess: (_answer, row) => {
      templatesChanged(queryClient, row.campaign_id);
      return queryClient.invalidateQueries({ queryKey: queryKeys.workshop() });
    },
  });
}
