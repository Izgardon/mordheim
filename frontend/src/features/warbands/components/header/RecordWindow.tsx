import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ModalSheet } from "@/components/ui/modal-sheet";
import { battleNumberLabel } from "@/features/battles/utils/battle-number";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { warbandRecordQuery } from "../../api/warband-queries";
import { formatTradeDate } from "../../utils/warband-utils";
import { RESULT_LABEL, opponentsLine } from "./header-windows";

type RecordWindowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  warbandId: number;
  warbandName: string;
  /** "3–2": its wins and losses. */
  record: string;
};

const RESULT_TONE = { won: "text-good", lost: "text-danger", no_winner: "text-faint" } as const;

/** Its last ten battles (the server's), each opening on the Battles page. */
export default function RecordWindow(props: RecordWindowProps) {
  const { open, onOpenChange, campaignId, warbandId } = props;
  const record = useQuery({ ...warbandRecordQuery(campaignId, warbandId), enabled: open });
  const battles = record.data ?? [];
  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={props.warbandName}
      title={`Record · ${props.record}`}
      closeButton
    >
      {record.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Reading the battles…</p>
      ) : record.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(record.error)}</p>
      ) : battles.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No battles fought yet.</p>
      ) : (
        <ul aria-label="Last battles" className="m-0 flex list-none flex-col p-0">
          {battles.map((battle) => (
            <li key={battle.id} className="border-t border-line">
              <Link
                to={`/campaigns/${campaignId}/battles?battle=${battle.id}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2 hover:bg-raised"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-ink">
                    {battleNumberLabel(battle.number) || formatTradeDate(battle.date)}
                    {battle.scenario ? ` · ${battle.scenario}` : ""}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {battle.opponents.length ? `Against ${opponentsLine(battle)}` : ""}
                  </span>
                </span>
                <span className={cn("text-sm font-bold", RESULT_TONE[battle.result])}>
                  {RESULT_LABEL[battle.result]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ModalSheet>
  );
}
