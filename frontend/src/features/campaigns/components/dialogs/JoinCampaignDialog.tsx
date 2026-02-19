import type { FormEvent } from "react";
import { useState } from "react";

// components
import { Button } from "@components/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from "@components/dialog";
import { Input } from "@components/input";
import { Label } from "@components/label";

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

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setForm(initialState);
      setError("");
    }
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
      <DialogContent className="max-w-[750px]">
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
              value={form.join_code}
              onChange={(event) => setForm({ join_code: event.target.value })}
              placeholder="WYR123"
              maxLength={6}
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Joining..." : "Join"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}





