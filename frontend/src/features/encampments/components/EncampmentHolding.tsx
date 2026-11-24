import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";

import { useHolding } from "../api/encampment-queries";
import type {
  CampaignEncampment,
  EncampmentTaker,
  EncampmentWarning,
  HoldingAction,
} from "../types";

const SELECT = "min-h-10 border border-strong bg-page px-2 text-sm text-ink";

/**
 * An open encampment's Take it (for one of your warbands, picked when you have several), Raze it
 * and Give it up, as its `capabilities` allow; the server's warnings show under them after.
 */
export default function EncampmentHolding({
  campaignId,
  encampment,
  takers,
}: {
  campaignId: number;
  encampment: CampaignEncampment;
  takers: EncampmentTaker[];
}) {
  const holding = useHolding(campaignId);
  const others = takers.filter((taker) => taker.id !== encampment.holder?.id);
  const [picked, setPicked] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<EncampmentWarning[]>([]);
  const [error, setError] = useState("");
  const [razing, setRazing] = useState(false);
  const { take, raze, give_up: giveUp } = encampment.capabilities;
  const forId = others.some((taker) => taker.id === picked) ? picked : (others[0]?.id ?? null);
  const act = (action: HoldingAction, warbandId?: number) => {
    setError("");
    setWarnings([]);
    holding.mutate(
      { encampment, action, warbandId },
      {
        onSuccess: (answer) => {
          setWarnings(answer.warnings);
          setRazing(false);
        },
        onError: (failure) => setError(getErrorMessage(failure, "Couldn't change who holds it.")),
      }
    );
  };
  const canTake = take && others.length > 0;
  if (!canTake && !raze && !giveUp && !warnings.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {canTake && others.length > 1 ? (
          <select
            aria-label="Take it for"
            className={SELECT}
            value={forId ?? ""}
            onChange={(event) => setPicked(Number(event.target.value))}
          >
            {others.map((taker) => (
              <option key={taker.id} value={taker.id}>
                {taker.name}
              </option>
            ))}
          </select>
        ) : null}
        {canTake ? (
          <Button
            size="sm"
            disabled={holding.isPending || !forId}
            onClick={() => forId && act("take", forId)}
          >
            {others.length === 1 && !others[0].mine ? `Take it for ${others[0].name}` : "Take it"}
          </Button>
        ) : null}
        {raze ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={holding.isPending}
            onClick={() => setRazing(true)}
          >
            Raze it
          </Button>
        ) : null}
        {giveUp ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={holding.isPending}
            onClick={() => act("give-up")}
          >
            Give it up
          </Button>
        ) : null}
      </div>
      {warnings.map((warning) => (
        <p key={warning.code} role="status" className="m-0 text-sm font-semibold text-danger">
          {warning.message}
        </p>
      ))}
      {error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={razing}
        onOpenChange={(next) => !next && setRazing(false)}
        title="Raze it"
        description={
          <p className="m-0 text-ink">
            {encampment.holder
              ? `Raze ${encampment.name}? ${encampment.holder.name} no longer holds it.`
              : `Raze ${encampment.name}?`}
          </p>
        }
        confirmText="Raze it"
        isConfirming={holding.isPending}
        onConfirm={() => act("raze")}
      />
    </div>
  );
}
