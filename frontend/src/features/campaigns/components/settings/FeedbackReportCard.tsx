import { useState } from "react";

import { Button } from "@components/button";
import { CardBackground } from "@components/card-background";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/select";

import { sendFeedbackReport } from "@/features/auth/api/auth-api";

const textareaClassName =
  "min-h-[120px] w-full rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)] focus-visible:outline-none focus-visible:shadow-[0_12px_22px_rgba(5,20,24,0.25),inset_0_0_0_1px_rgba(57,255,77,0.25),inset_0_0_20px_rgba(57,255,77,0.2)]";

type FeedbackReportCardProps = {
  campaignId?: number;
  campaignName?: string;
  warbandId?: number;
  warbandName?: string;
};

const REPORT_TYPE_PLACEHOLDERS = {
  Bug: "Describe the bug, what you were doing, and what you expected to happen.",
  Feedback: "Share your feedback, suggestion, or improvement idea.",
} as const;

export default function FeedbackReportCard({
  campaignId,
  campaignName,
  warbandId,
  warbandName,
}: FeedbackReportCardProps) {
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<"Bug" | "Feedback">("Bug");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedMessage = message.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError("");
      setReportType("Bug");
      setMessage("");
    }
  };

  const handleSubmit = async () => {
    if (!trimmedMessage) {
      setError("Message is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await sendFeedbackReport({
        report_type: reportType,
        message: trimmedMessage,
        campaign_id: campaignId,
        campaign_name: campaignName,
        warband_id: warbandId,
        warband_name: warbandName,
      });
      setMessage("");
      setOpen(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Unable to send feedback report.");
      } else {
        setError("Unable to send feedback report.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-label="Feedback and bug report">
      <CardBackground className="space-y-4 bg-[rgba(12,9,6,0.92)] p-3 sm:p-6">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Feedback/Bug Report</h3>
          <p className="text-sm text-muted-foreground">
            Send a report with your account and current campaign context so issues are easier to
            trace.
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="secondary">Send report</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[32rem]">
            <DialogHeader>
              <DialogTitle className="text-xl">Feedback/Bug Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor="feedback-report-type"
                >
                  Type
                </label>
                <Select
                  value={reportType}
                  onValueChange={(value) => setReportType(value as "Bug" | "Feedback")}
                >
                  <SelectTrigger id="feedback-report-type" className="bg-background/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bug">Bug</SelectItem>
                    <SelectItem value="Feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label
                htmlFor="feedback-report-message"
                className="text-sm font-medium text-foreground"
              >
                Report
              </label>
              <textarea
                id="feedback-report-message"
                className={textareaClassName}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={REPORT_TYPE_PLACEHOLDERS[reportType]}
                disabled={isSubmitting}
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !trimmedMessage}>
                {isSubmitting ? "Sending..." : "Send"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardBackground>
    </section>
  );
}
