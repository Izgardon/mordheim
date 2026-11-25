import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

import {
  deleteWorkshop,
  importIntoWorkshop,
  listBookTemplates,
  listWorkshops,
  makeListWorkshop,
  makeWarbandWorkshop,
  previewSharedCode,
} from "./workshop-api";
import type { MakeListBody, MakeWarbandBody } from "../types/workshop-types";

/** A code as the server reads it: case-blind, spaces and dashes ignored. */
export const cleanCode = (typed: string) => typed.toUpperCase().replace(/[\s-]/g, "");

/** Codes are 8 characters: a preview is read once one is typed in full. */
export const CODE_LENGTH = 8;

/** My custom warbands and warband lists (the Home page), read on every visit. */
export function useWorkshops() {
  return useQuery({
    queryKey: queryKeys.workshop(),
    queryFn: ({ signal }) => listWorkshops(signal),
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

/** Every workshop write reads my workshops again, and nothing else. */
function useWorkshopMutation<T, R>(write: (body: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workshop() }),
  });
}

export const useMakeWarband = () =>
  useWorkshopMutation((body: MakeWarbandBody) => makeWarbandWorkshop(body));
export const useMakeList = () =>
  useWorkshopMutation((body: MakeListBody) => makeListWorkshop(body));
export const useImportIntoWorkshop = () =>
  useWorkshopMutation((code: string) => importIntoWorkshop(cleanCode(code)));
export const useDeleteWorkshop = () => useWorkshopMutation((id: number) => deleteWorkshop(id));
