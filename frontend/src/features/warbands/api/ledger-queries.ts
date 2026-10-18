import {
  infiniteQueryOptions,
  keepPreviousData,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { applyWarbandUpdate, isWarbandQuery } from "./warband-cache";
import {
  createWarbandTrade,
  listWarbandLogPage,
  listWarbandTradePage,
  updateWarbandTrade,
} from "./warbands-api";

import type { CursorPage } from "./cursor-pages";
import type { WarbandTrade, WarbandTradeEdit, WarbandTradePayload } from "../types/warband-types";

/* The Treasury's ledger and the Logs tab's entries as server state: re-exported by economy-queries. */

export const TREASURY_PAGE_SIZE = 25;
export const LOG_PAGE_SIZE = 12;

/**
 * Cursor pages, kept a while (ECON-PERF-06, ECON-PERF-08): a tab shown again within this time
 * reads nothing. A write the page applies marks them stale (`applyWarbandUpdate`), so the next
 * showing reads them again; a write whose answer has the row puts it in.
 */
const LEDGER_PAGES = {
  initialPageParam: null as string | null,
  getNextPageParam: (last: { next_cursor: string | null }) => last.next_cursor ?? undefined,
  staleTime: 30_000,
  refetchOnWindowFocus: false,
} as const;

/** The ledger, newest row first, group rows carrying their children, 25 rows a page. */
export const warbandTreasuryQuery = (campaignId: number, warbandId: number) =>
  infiniteQueryOptions({
    queryKey: queryKeys.campaign.warbandTreasury(campaignId, warbandId),
    queryFn: ({ pageParam }) =>
      listWarbandTradePage(warbandId, { limit: TREASURY_PAGE_SIZE, cursor: pageParam }),
    ...LEDGER_PAGES,
  });

/** The log, newest first, 12 entries a page, filtered on the server by feature ("" for all). */
export const warbandLogsQuery = (campaignId: number, warbandId: number, feature = "") =>
  infiniteQueryOptions({
    queryKey: [...queryKeys.campaign.warbandLogs(campaignId, warbandId), feature] as const,
    queryFn: ({ pageParam }) =>
      listWarbandLogPage(warbandId, { limit: LOG_PAGE_SIZE, cursor: pageParam, feature }),
    // Another filter's pages stay on screen until its first page answers.
    placeholderData: keepPreviousData,
    ...LEDGER_PAGES,
  });

type LedgerPages = InfiniteData<CursorPage<WarbandTrade>, string | null>;

/** Changes the rows of each cached ledger of the warband, page by page. */
const patchLedgers = (
  queryClient: QueryClient,
  warbandId: number,
  patch: (rows: WarbandTrade[], pageIndex: number) => WarbandTrade[]
) =>
  queryClient.setQueriesData<LedgerPages>(
    { predicate: isWarbandQuery(warbandId, "treasury") },
    (data: LedgerPages | undefined) =>
      data && {
        ...data,
        pages: data.pages.map((page, index) => ({ ...page, results: patch(page.results, index) })),
      }
  );

/** A new ledger row on top of each cached ledger of the warband (the server lists newest first). */
export function prependTreasuryRow(queryClient: QueryClient, warbandId: number, row: WarbandTrade) {
  patchLedgers(queryClient, warbandId, (rows, index) => (index === 0 ? [row, ...rows] : rows));
}

/** The row as the server answered it, in each cached ledger of the warband (or its group). */
export function replaceTreasuryRow(queryClient: QueryClient, warbandId: number, row: WarbandTrade) {
  const replace = (entry: WarbandTrade): WarbandTrade =>
    entry.id === row.id
      ? row
      : {
          ...entry,
          children: entry.children.map((child) =>
            child.id === row.id ? { ...child, ...row } : child
          ),
        };
  patchLedgers(queryClient, warbandId, (rows) => rows.map(replace));
}

/**
 * A manual Treasury entry. The answer is the row, so it goes on top of the ledger; it carries no
 * gold, so the summary is re-read (BUG-37). Once the answer carries the summary, merge it here.
 */
export function useLedgerEntry(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WarbandTradePayload) => createWarbandTrade(warbandId, payload),
    onSuccess: (row) => {
      applyWarbandUpdate(queryClient, warbandId);
      prependTreasuryRow(queryClient, warbandId, row);
    },
  });
}

/** Edits a hand-entered row's description and notes (decision 6); the answer is the row. */
export function useLedgerRowEdit(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, ...payload }: WarbandTradeEdit & { tradeId: number }) =>
      updateWarbandTrade(warbandId, tradeId, payload),
    onSuccess: (row) => replaceTreasuryRow(queryClient, warbandId, row),
  });
}
