import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { getErrorMessage } from "@/lib/get-error-message";

import { useBountyCandidates } from "../api/bounty-queries";
import { goldText } from "../bounty-view";
import { useBountyActions } from "../hooks/useBountyActions";
import type { Bounty, BountyCandidate, ClaimBountyPayload } from "../types";
import { FIELD_LABEL, NATIVE_SELECT } from "./fields";

const candidateKey = (candidate: BountyCandidate) =>
  candidate.kill_id ? `kill-${candidate.kill_id}` : `out-${candidate.battle.id}`;

/**
 * Claim a bounty: which of your units took the hero out, and optionally in which battle. The
 * record suggests your kills and out-of-actions of him since it was posted: a kill names its
 * killer and its battle. With nothing on record the claim still goes: the poster decides.
 */
export default function ClaimBountyDialog({
  bounty,
  onClose,
  campaignId,
}: {
  bounty: Bounty | null;
  onClose: () => void;
  campaignId: number;
}) {
  const found = useBountyCandidates(campaignId, bounty?.id ?? null);
  const actions = useBountyActions(campaignId);
  const [picked, setPicked] = useState<string | null>(null);
  const [unit, setUnit] = useState("");
  const [battle, setBattle] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const record = found.data;
  const candidates = record?.candidates ?? [];
  const choice = picked ?? (candidates[0] ? candidateKey(candidates[0]) : "other");
  const candidate = candidates.find((entry) => candidateKey(entry) === choice) ?? null;
  const fromKill = candidate?.kill_id ? candidate : null;
  const unitValue =
    unit || (record?.units[0] ? `${record.units[0].kind}:${record.units[0].id}` : "");
  const battleValue = battle || (candidate ? String(candidate.battle.id) : "");
  const poster = bounty?.posted_by.user_name ?? "The poster";

  const close = () => {
    setPicked(null);
    setUnit("");
    setBattle("");
    setError("");
    onClose();
  };
  const payload = (): ClaimBountyPayload | null => {
    if (fromKill?.kill_id) return { kill_id: fromKill.kill_id };
    const [kind, id] = unitValue.split(":");
    if (!kind || !id) return null;
    return {
      unit: { kind: kind as "hero" | "henchmen_group" | "hireling", id: Number(id) },
      ...(battleValue ? { battle_id: Number(battleValue) } : {}),
    };
  };
  const submit = async () => {
    const body = payload();
    if (!bounty || !body) return;
    setSending(true);
    setError("");
    try {
      await actions.claim(bounty.id, body);
      toast(`Claim sent: ${poster} decides.`);
      close();
    } catch (failure) {
      setError(getErrorMessage(failure, "The claim didn't go through. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalSheet
      open={bounty !== null}
      onOpenChange={(next) => (next ? null : close())}
      kicker={bounty ? `${goldText(bounty.amount)} · posted by ${poster}` : "Bounty"}
      title={bounty ? `Claim the bounty on ${bounty.target.name}` : "Claim a bounty"}
      footer={
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={close}>
            Cancel
          </Button>
          <Button
            className="min-h-12 text-[15px]"
            disabled={sending || !record || payload() === null}
            onClick={() => void submit()}
          >
            {sending ? "Sending…" : "Claim it"}
          </Button>
        </div>
      }
    >
      {found.isPending ? (
        <p className="m-0 text-sm text-muted-foreground">Reading the record…</p>
      ) : found.error ? (
        <p className="m-0 text-sm text-danger">{getErrorMessage(found.error)}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="pb-1.5 text-xs font-bold text-muted-foreground">On record</legend>
            {candidates.map((entry) => (
              <Chip
                key={candidateKey(entry)}
                pressed={choice === candidateKey(entry)}
                className="h-auto justify-start py-2 text-left"
                onClick={() => setPicked(candidateKey(entry))}
              >
                <span className="flex flex-col">
                  <span>{entry.text}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {[
                      entry.battle.scenario,
                      entry.battle.date,
                      entry.round && `round ${entry.round}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Chip>
            ))}
            <Chip
              pressed={choice === "other"}
              className="justify-start"
              onClick={() => setPicked("other")}
            >
              {candidates.length ? "Something else" : "Nothing on record: say what happened"}
            </Chip>
            {candidates.length === 0 ? (
              <p className="m-0 text-xs text-muted-foreground">
                Nothing on record shows your warband taking {bounty?.target.name} out since the
                bounty was posted. You can claim it anyway.
              </p>
            ) : null}
          </fieldset>
          {fromKill ? (
            <p className="m-0 text-sm text-text2">
              {fromKill.unit?.name ?? "Your unit"} took him out in {fromKill.battle.scenario}.
            </p>
          ) : (
            <>
              <label className={FIELD_LABEL}>
                Which of your units took him out
                <select
                  className={NATIVE_SELECT}
                  value={unitValue}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  {record?.units.map((entry) => (
                    <option key={`${entry.kind}:${entry.id}`} value={`${entry.kind}:${entry.id}`}>
                      {entry.name}
                      {entry.dead ? " (dead)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={FIELD_LABEL}>
                In which battle (optional)
                <select
                  className={NATIVE_SELECT}
                  value={battleValue}
                  onChange={(event) => setBattle(event.target.value)}
                >
                  <option value="">No battle</option>
                  {record?.battles.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.scenario} · {entry.date}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <p className="m-0 text-xs text-muted-foreground">
            {poster} decides: the gold moves when the claim is accepted.
          </p>
          {error ? (
            <p role="alert" className="m-0 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </ModalSheet>
  );
}
