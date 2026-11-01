import { useState } from "react";

import { Button } from "@components/button";
import { Card } from "@components/card";
import { SECTION_TITLE } from "@components/section-title";
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
import { getErrorMessage } from "@/lib/get-error-message";

/** The server's limit on a report (FeedbackReportSerializer). */
const MAX_REPORT_LENGTH = 2000;

const textareaClassName =
  "min-h-[120px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

type FeedbackReportCardProps = {
  campaignId?: number;
  campaignName?: string;
  warbandId?: number;
  warbandName?: string;
};

const REPORT_TYPE_PLACEHOLDERS = {
  Bug: "What happened, and what you expected",
  Feedback: "Your idea",
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
  const [isSent, setIsSent] = useState(false);

  const trimmedMessage = message.trim();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setIsSent(false);
    }
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
      setIsSent(true);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to send feedback report."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-label="Feedback and bug report">
      <Card className="flex flex-col items-start gap-4 p-5 max-[960px]:p-4">
        <h3 className={SECTION_TITLE}>Feedback/Bug Report</h3>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="secondary">Send report</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[32rem]">
            <DialogHeader>
              <DialogTitle className="text-xl">Feedback/Bug Report</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint"
                  htmlFor="feedback-report-type"
                >
                  Type
                </label>
                <Select
                  value={reportType}
                  onValueChange={(value) => setReportType(value as "Bug" | "Feedback")}
                >
                  <SelectTrigger id="feedback-report-type">
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
                className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint"
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
                maxLength={MAX_REPORT_LENGTH}
                aria-describedby="feedback-report-count"
              />
              <p id="feedback-report-count" className="text-right text-xs text-muted-foreground">
                {message.length}/{MAX_REPORT_LENGTH} characters
              </p>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
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
        {isSent ? (
          <p role="status" className="text-sm text-good">
            Thanks, report sent
          </p>
        ) : null}
      </Card>
    </section>
  );
}
