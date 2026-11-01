import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

import { useBountyTargets, useCampaignBounties } from "../api/bounty-queries";
import { goldText, owedWith } from "../bounty-view";
import { useBountyActions } from "../hooks/useBountyActions";
import { FIELD_LABEL, NATIVE_SELECT, TEXTAREA } from "./fields";

/** The hero a card's Post a bounty names; without one the dialog asks for a warband and a hero. */
export type BountyTarget = { heroId: number; name: string; warbandName: string };

/**
 * Post a bounty (design E): a hero of another warband, the gold and a note. Nothing is held: the
 * dialog warns when your open bounties would come to more than your warband holds, and posts
 * anyway (the gold moves only when a claim is accepted).
 */
export default function PostBountyDialog({
  open,
  onClose,
  campaignId,
  target,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: number;
  target?: BountyTarget | null;
}) {
  const list = useCampaignBounties(campaignId).data;
  const targets = useBountyTargets(campaignId, open && !target);
  const actions = useBountyActions(campaignId);
  const [warbandId, setWarbandId] = useState<number | null>(null);
  const [heroId, setHeroId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const warbands = targets.data ?? [];
  const warband = warbands.find((entry) => entry.warband_id === warbandId) ?? warbands[0];
  const pickedHero = target ? target.heroId : (heroId ?? warband?.heroes[0]?.id ?? null);
  const heroName = target
    ? target.name
    : warband?.heroes.find((hero) => hero.id === pickedHero)?.name;
  const gold = Number(amount);
  const valid = Number.isInteger(gold) && gold > 0 && pickedHero !== null;
  const owed = owedWith(list, valid ? gold : 0);

  // A fresh form each time it opens (not as it closes, which would show while it animates out).
  const [shown, setShown] = useState(open);
  if (open !== shown) {
    setShown(open);
    if (open) {
      setWarbandId(null);
      setHeroId(null);
      setAmount("");
      setNote("");
      setError("");
    }
  }
  const close = onClose;
  const submit = async () => {
    if (!valid || pickedHero === null) return;
    setSending(true);
    setError("");
    try {
      await actions.post({ hero_id: pickedHero, amount: gold, note: note.trim() });
      toast(`Bounty posted on ${heroName ?? "the hero"}: ${goldText(gold)}.`);
      close();
    } catch (failure) {
      setError(getErrorMessage(failure, "The bounty wasn't posted. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={(next) => (next ? null : close())}
      kicker={target ? `${target.warbandName}` : "Bounties"}
      title={target ? `Post a bounty on ${target.name}` : "Post a bounty"}
      footer={
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={close}>
            Cancel
          </Button>
          <Button
            className="min-h-12 text-[15px]"
            disabled={!valid || sending}
            onClick={() => void submit()}
          >
            {sending ? "Posting…" : valid ? `Post ${goldText(gold)}` : "Post a bounty"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {target ? null : targets.isPending ? (
          <p className="m-0 text-sm text-muted-foreground">Finding the heroes…</p>
        ) : warbands.length === 0 ? (
          <p className="m-0 text-sm text-text2">No other warband has a hero to put a bounty on.</p>
        ) : (
          <>
            <label className={FIELD_LABEL}>
              Warband
              <select
                className={NATIVE_SELECT}
                value={warband?.warband_id ?? ""}
                onChange={(event) => {
                  setWarbandId(Number(event.target.value));
                  setHeroId(null);
                }}
              >
                {warbands.map((entry) => (
                  <option key={entry.warband_id} value={entry.warband_id}>
                    {entry.warband_name} ({entry.user_name})
                  </option>
                ))}
              </select>
            </label>
            <label className={FIELD_LABEL}>
              Hero
              <select
                className={NATIVE_SELECT}
                value={pickedHero ?? ""}
                onChange={(event) => setHeroId(Number(event.target.value))}
              >
                {warband?.heroes.map((hero) => (
                  <option key={hero.id} value={hero.id}>
                    {hero.name}
                    {hero.is_leader ? " (leader)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className={FIELD_LABEL}>
          Reward (gc)
          <Input
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
          />
        </label>
        <label className={FIELD_LABEL}>
          Note (optional)
          <textarea
            className={TEXTAREA}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        {valid && owed?.short ? (
          <p
            role="status"
            className="m-0 border border-danger-line bg-danger-bg p-2.5 text-xs text-danger"
          >
            Your open bounties would come to {goldText(owed.owed)} and {owed.warbandName} holds{" "}
            {goldText(owed.gold)}. You can post it anyway: the gold moves only when a claim is
            accepted.
          </p>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">
            Nothing is held now. The gold moves when you accept a claim.
          </p>
        )}
        {error ? (
          <p role="alert" className="m-0 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </ModalSheet>
  );
}
