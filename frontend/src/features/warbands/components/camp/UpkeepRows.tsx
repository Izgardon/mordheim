import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import FeePayment from "@/features/hirelings/components/fees/FeePayment";
import type { LinePick, Payment } from "@/features/hirelings/components/fees/fee-payment";
import { feeOf } from "@/features/hirelings/fees";
import type { BattlePostbattleUpkeepEntry } from "@/features/battles/types/battle-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useResourceCreate } from "../../api/economy-queries";
import { useWarbandCacheUpdate } from "../../api/warband-cache";
import { unitApi } from "../../units/unit-api";
import type { UpkeepLine } from "./camp-state";
import type { OpenCamp } from "./camp-types";

const pickOf = (resourceId: number | null | undefined): LinePick =>
  resourceId === undefined ? undefined : resourceId === null ? "none" : resourceId;

/** A line's draft entry as the payment editor shows it, each resource with what pays it. */
function paymentOfEntry(line: UpkeepLine): Payment {
  const fees = feeOf(line.fee).resources;
  return {
    gold: String(line.entry.cost ?? 0),
    roll: null,
    lines: (line.entry.resources ?? []).map((resource) => {
      const fee = fees.find((entry) => entry.resource === resource.resource);
      return {
        resource: resource.resource,
        amount: String(resource.amount),
        names: fee?.names,
        default_resource: fee?.default_resource,
        pick: pickOf(resource.resource_id),
      };
    }),
  };
}

/** The payment back as the draft keeps it: a resource line names its counter only when one was picked. */
function entryOf(
  entry: BattlePostbattleUpkeepEntry,
  payment: Payment
): BattlePostbattleUpkeepEntry {
  const whole = (value: string) => Math.max(0, Math.trunc(Number(value) || 0));
  return {
    ...entry,
    cost: whole(payment.gold),
    resources: payment.lines.map((line) => ({
      resource: line.resource,
      amount: whole(line.amount),
      ...(line.pick === undefined ? {} : { resource_id: line.pick === "none" ? null : line.pick }),
    })),
  };
}

/** One hired sword's upkeep: what he is paid (saved as it is edited) and Pay or Let go. */
function UpkeepRow({ camp, line }: { camp: OpenCamp; line: UpkeepLine }) {
  const updateCache = useWarbandCacheUpdate();
  const addCounter = useResourceCreate(camp.warbandId);
  const [payment, setPayment] = useState(() => paymentOfEntry(line));
  const [lettingGo, setLettingGo] = useState(false);
  const edited = useRef(false);
  const { draft, save } = camp;
  const write = (entry: BattlePostbattleUpkeepEntry) =>
    void save({
      ...draft,
      upkeep: { ...draft.upkeep, entries: { ...draft.upkeep.entries, [line.key]: entry } },
    });
  // an edit saves to the draft once the typing stops: Ready charges what it holds
  useEffect(() => {
    if (!edited.current) return;
    const timer = window.setTimeout(() => write(entryOf(line.entry, payment)), 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only an edit saves
  }, [payment]);
  const letGo = async () => {
    try {
      const result = await unitApi("hireling").batch(camp.warbandId, { dismiss: [line.id] });
      updateCache(camp.warbandId, {
        hirelings: result.units,
        summary: result.summary,
        removedHirelingIds: [line.id],
      });
    } catch (error) {
      toast.error("Couldn't let him go.", { description: getErrorMessage(error) });
    }
  };
  const button = camp.isMobile ? "h-10 text-xs" : "h-8 text-xs";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t border-dashed border-line",
        camp.isMobile ? "py-2 pl-6 pr-1.5" : "py-[7px] pl-[22px] pr-1"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{line.name}</span>
        {line.status !== "due" ? (
          <span
            className={cn(
              "text-xs font-bold",
              line.status === "paid" ? "text-good" : "text-danger"
            )}
          >
            {line.status === "paid" ? "Paid" : "Let go"}
          </span>
        ) : lettingGo ? (
          <div className="flex gap-1">
            <Button size="sm" variant="danger" className="h-8 text-xs" onClick={() => void letGo()}>
              Let go: carried items are lost
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => setLettingGo(false)}
            >
              Keep
            </Button>
          </div>
        ) : (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              className={button}
              onClick={() => write({ ...entryOf(line.entry, payment), paid: true })}
            >
              Pay
            </Button>
            <Button size="sm" variant="ghost" className={button} onClick={() => setLettingGo(true)}>
              Let go
            </Button>
          </div>
        )}
      </div>
      {line.status === "gone" ? null : (
        <FeePayment
          fee={line.fee}
          payment={payment}
          onChange={(next) => {
            edited.current = true;
            setPayment(next);
          }}
          counters={camp.resources}
          onAddCounter={(resource) => addCounter.mutateAsync(resource).catch(() => undefined)}
          idPrefix={`upkeep-${line.id}`}
          compact
        />
      )}
    </div>
  );
}

/**
 * Camp's upkeep (the fees step): each hired sword's fee, gold and resources, prefilled from his
 * upkeep and editable, each resource from one of the warband's resources (the one of its name to
 * start). Pay is a tick; Ready charges everyone still on the roster what their line holds.
 */
export default function UpkeepRows({ camp, lines }: { camp: OpenCamp; lines: UpkeepLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <UpkeepRow key={line.key} camp={camp} line={line} />
      ))}
    </>
  );
}
