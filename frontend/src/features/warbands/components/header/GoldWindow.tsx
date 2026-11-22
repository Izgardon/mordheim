import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

import { warbandTreasuryQuery } from "../../api/economy-queries";
import { formatTradeDate, ledgerTotal } from "../../utils/warband-utils";
import { RECENT_TRADES } from "./header-windows";

type GoldWindowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  warbandId: number;
  warbandName: string;
  gold: number;
  /** Closes the window on the Treasury tab. */
  onTreasury: () => void;
};

/** The ledger's last few rows (the Treasury tab's first page, read when it opens) and its gold. */
export default function GoldWindow(props: GoldWindowProps) {
  const { open, onOpenChange, campaignId, warbandId } = props;
  const ledger = useInfiniteQuery({
    ...warbandTreasuryQuery(campaignId, warbandId),
    enabled: open,
  });
  const rows = (ledger.data?.pages[0]?.results ?? []).slice(0, RECENT_TRADES);
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={props.warbandName}
      title={`Gold · ${props.gold} gc`}
      closeButton
      footer={
        <Button variant="secondary" onClick={props.onTreasury}>
          Open the Treasury
        </Button>
      }
    >
      {ledger.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Reading the ledger…</p>
      ) : ledger.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(ledger.error)}</p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No trades yet.</p>
      ) : (
        <ul aria-label="Last trades" className="m-0 flex list-none flex-col p-0">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-baseline gap-3 border-t border-line py-2"
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                {row.action}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-ink">{row.description}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTradeDate(row.created_at)}
                </span>
              </span>
              <span className="font-mono text-sm font-bold text-head">{ledgerTotal(row)} gc</span>
            </li>
          ))}
        </ul>
      )}
    </ModalSheet>
  );
}
