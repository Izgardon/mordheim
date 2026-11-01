import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChipLabel } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { bountyRoles, claimLine, goldText, goneText, type BountyReader } from "../bounty-view";
import type { Bounty } from "../types";
import type { useBountyActions } from "../hooks/useBountyActions";

type BountyCardProps = {
  bounty: Bounty;
  reader: BountyReader;
  actions: ReturnType<typeof useBountyActions>;
  onClaim: (bounty: Bounty) => void;
};

/**
 * One open bounty (design E's "Open bounties"): the hero and the reward, his warband and who
 * posted it, "On your hero" when he is the reader's, the note, and whatever waits on a claim.
 * The poster accepts (and pays) or declines each claim and can withdraw the bounty; anyone else
 * with a warband claims it; a claimant can take his claim back.
 */
export default function BountyCard({ bounty, reader, actions, onClaim }: BountyCardProps) {
  const roles = bountyRoles(bounty, reader);
  const [busy, setBusy] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const gone = goneText(bounty);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await action();
      if (done) toast(done);
    } catch (error) {
      toast.error(getErrorMessage(error, "That didn't go through. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-1 border bg-surface px-3.5 py-3",
        roles.onMine ? "border-danger-line" : "border-border"
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-[17px] font-semibold text-head">
          {bounty.target.name}
        </span>
        <span className="shrink-0 font-mono text-sm font-bold text-accent-hi">
          {goldText(bounty.amount)}
        </span>
      </div>
      <span className="text-[13px] text-text2">
        {bounty.target.warband_name} · posted by {bounty.posted_by.user_name}
      </span>
      {roles.onMine ? (
        <ChipLabel tone="danger" className="self-start">
          {bounty.target.is_leader ? "On your captain" : "On your hero"}
        </ChipLabel>
      ) : null}
      {bounty.note ? <p className="m-0 text-[13px] italic text-text2">{bounty.note}</p> : null}
      {gone ? <p className="m-0 text-xs text-muted-foreground">{gone}</p> : null}
      {roles.waiting.map((claim) => (
        <div key={claim.id} className="mt-1 flex flex-col gap-1.5 border-t border-line pt-2">
          <span className="text-[13px] text-ink">
            {claimLine(claim)}
            {claim === roles.myClaim ? `: waiting for ${bounty.posted_by.user_name}` : ""}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {roles.toAnswer.includes(claim) ? (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => actions.accept(bounty.id, claim.id),
                      `Paid ${goldText(bounty.amount)} to ${claim.warband_name}.`
                    )
                  }
                >
                  Accept and pay {goldText(bounty.amount)}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void run(() => actions.decline(bounty.id, claim.id))}
                >
                  Decline
                </Button>
              </>
            ) : null}
            {claim === roles.myClaim ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void run(() => actions.decline(bounty.id, claim.id))}
              >
                Take my claim back
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      {roles.canClaim || roles.canWithdraw ? (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {roles.canClaim ? (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onClaim(bounty)}>
              Claim
            </Button>
          ) : null}
          {roles.canWithdraw ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setWithdrawing(true)}>
              Withdraw
            </Button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title="Withdraw this bounty?"
        description={
          roles.waiting.length
            ? `The ${goldText(bounty.amount)} on ${bounty.target.name} comes off, and the claims waiting on it close.`
            : `The ${goldText(bounty.amount)} on ${bounty.target.name} comes off. Nothing was held, so no gold moves.`
        }
        confirmText="Withdraw"
        isConfirming={busy}
        onConfirm={() =>
          void run(() => actions.withdraw(bounty.id)).then(() => setWithdrawing(false))
        }
      />
    </li>
  );
}
