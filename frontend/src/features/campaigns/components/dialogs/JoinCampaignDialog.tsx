import type { FormEvent } from "react";
import { useState } from "react";

// components
import { Button } from "@components/button";
import { Input } from "@components/input";
import { ModalSheet } from "@components/modal-sheet";
import { Field, FormError } from "../settings/settings-ui";
// types
import type { CampaignJoinPayload } from "../../types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

type JoinCampaignDialogProps = {
  onJoin: (payload: CampaignJoinPayload) => Promise<void>;
  /** The trigger's classes (full width on a phone). */
  className?: string;
};

/** Join a campaign with its code (design E): a modal on the web, a sheet on a phone. */
export default function JoinCampaignDialog({ onJoin, className }: JoinCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setCode("");
      setError("");
    }
  };

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onJoin({ join_code: code.trim().toUpperCase() });
      setOpen(false);
      setCode("");
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to join campaign"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="secondary" className={className} onClick={() => handleOpenChange(true)}>
        Join a campaign
      </Button>
      <ModalSheet
        open={open}
        onOpenChange={handleOpenChange}
        kicker="Campaigns"
        title="Join a campaign"
        description="Enter the six-character rally code a member of the campaign shared with you."
        className="max-w-[480px]"
        footer={
          <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
            <Button
              variant="secondary"
              className="min-h-12"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="min-h-12"
              disabled={isSubmitting || !code.trim()}
              onClick={() => void submit()}
            >
              {isSubmitting ? "Joining..." : "Join"}
            </Button>
          </div>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
          <Field
            label="Rally code"
            htmlFor="join-code"
            hint="Six letters and numbers, from anyone already in the campaign."
          >
            <Input
              id="join-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              className="h-12 font-mono text-lg font-bold uppercase tracking-[0.2em] md:h-12"
            />
          </Field>
          <FormError message={error} />
        </form>
      </ModalSheet>
    </>
  );
}
