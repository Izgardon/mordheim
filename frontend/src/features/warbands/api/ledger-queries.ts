import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { isWarbandQuery } from "./warband-cache";
import { updateWarbandTrade } from "./warbands-api";

import type { WarbandTrade, WarbandTradeEdit } from "../types/warband-types";

/* The Treasury's ledger rows as server state: re-exported by economy-queries. */

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
  queryClient.setQueriesData<WarbandTrade[]>(
    { predicate: isWarbandQuery(warbandId, "treasury") },
    (rows: WarbandTrade[] | undefined) => rows?.map(replace)
  );
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
