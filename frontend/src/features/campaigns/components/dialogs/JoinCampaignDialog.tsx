import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

// components
import { Button } from "@components/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from "@components/dialog";
import { Input } from "@components/input";
import { Label } from "@components/label";
import { useMediaQuery } from "@/lib/use-media-query";

// types
import type { CampaignJoinPayload } from "../../types/campaign-types";

const initialState: CampaignJoinPayload = {
  join_code: "",
};

type JoinCampaignDialogProps = {
  onJoin: (payload: CampaignJoinPayload) => Promise<void>;
};

export default function JoinCampaignDialog({ onJoin }: JoinCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignJoinPayload>(initialState);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      setForm(initialState);
      setError("");
    }
  };

  useEffect(() => {
    if (!open && focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
  }, [open]);

  const handleOpenAutoFocus = (event: Event) => {
    if (!isMobile) {
      return;
    }
    event.preventDefault();
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = window.setTimeout(() => {
      codeInputRef.current?.focus();
      codeInputRef.current?.scrollIntoView({ block: "center" });
    }, 320);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onJoin({ join_code: form.join_code.trim().toUpperCase() });
      setOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to join campaign");
      } else {
        setError("Unable to join campaign");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Join</Button>
      </DialogTrigger>
      <DialogContent className="max-w-[750px]" onOpenAutoFocus={handleOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold" style={{ color: "#a78f79" }}>
            Join a campaign
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="join-code">Rally code</Label>
            <Input
              id="join-code"
              ref={codeInputRef}
              value={form.join_code}
              onChange={(event) => setForm({ join_code: event.target.value })}
              placeholder="WYR123"
              maxLength={6}
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Joining..." : "Join"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}





