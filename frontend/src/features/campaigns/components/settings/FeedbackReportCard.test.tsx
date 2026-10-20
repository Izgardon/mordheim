import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FeedbackReportCard from "./FeedbackReportCard";

const { sendFeedbackReport } = vi.hoisted(() => ({
  sendFeedbackReport: vi.fn(),
}));

vi.mock("@/features/auth/api/auth-api", () => ({
  sendFeedbackReport,
}));

vi.mock("@components/dialog", () => {
  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } | null>(null);

  return {
    Dialog: ({
      open,
      onOpenChange,
      children,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      children: React.ReactNode;
    }) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
    ),
    DialogTrigger: ({
      asChild,
      children,
    }: {
      asChild?: boolean;
      children: React.ReactElement<{ onClick?: () => void }>;
    }) => {
      const dialog = React.useContext(DialogContext);
      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, {
          onClick: () => {
            children.props.onClick?.();
            dialog?.onOpenChange(true);
          },
        });
      }
      return <button onClick={() => dialog?.onOpenChange(true)}>{children}</button>;
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => {
      const dialog = React.useContext(DialogContext);
      return dialog?.open ? <div role="dialog">{children}</div> : null;
    },
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  };
});

vi.mock("@components/select", () => ({
  Select: ({
    value,
    onValueChange,
    children: _children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      id="feedback-report-type"
      aria-label="Type"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="Bug">Bug</option>
      <option value="Feedback">Feedback</option>
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

vi.mock("@/lib/use-media-query", () => ({
  useMediaQuery: () => false,
}));

describe("FeedbackReportCard", () => {
  beforeEach(() => {
    sendFeedbackReport.mockReset();
  });

  it("renders the feedback section", () => {
    render(<FeedbackReportCard />);

    expect(screen.getByRole("heading", { name: "Feedback/Bug Report" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send report" })).toBeInTheDocument();
  });

  it("opens the dialog and blocks blank submissions", async () => {
    render(<FeedbackReportCard />);

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Report")).toBeInTheDocument();

    const sendButton = within(dialog).getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
    expect(sendFeedbackReport).not.toHaveBeenCalled();
  });

  it("changes the placeholder when the report type changes", () => {
    render(<FeedbackReportCard />);

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByLabelText("Report")).toHaveAttribute(
      "placeholder",
      "Describe the bug, what you were doing, and what you expected to happen."
    );

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "Feedback" } });
    expect(screen.getByLabelText("Report")).toHaveAttribute(
      "placeholder",
      "Share your feedback, suggestion, or improvement idea."
    );
  });

  it("submits a report, closes the dialog, and clears the textarea", async () => {
    sendFeedbackReport.mockResolvedValue({ detail: "Feedback report sent." });

    render(
      <FeedbackReportCard
        campaignId={7}
        campaignName="Shadows Over Mordheim"
        warbandId={12}
        warbandName="Iron Vultures"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    const dialog = screen.getByRole("dialog");
    const textarea = within(dialog).getByLabelText("Report");

    fireEvent.change(within(dialog).getByLabelText("Type"), { target: { value: "Feedback" } });
    fireEvent.change(textarea, { target: { value: " Found a bug in rewards " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(sendFeedbackReport).toHaveBeenCalledWith({
        report_type: "Feedback",
        message: "Found a bug in rewards",
        campaign_id: 7,
        campaign_name: "Shadows Over Mordheim",
        warband_id: 12,
        warband_name: "Iron Vultures",
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.getByLabelText("Report")).toHaveValue("");
  });

  it("thanks you once the report is sent, until you write another (CAMP-NEW-08)", async () => {
    sendFeedbackReport.mockResolvedValue({ detail: "Feedback report sent." });
    render(<FeedbackReportCard />);

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Report"), { target: { value: "Hit a bug" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Thanks, report sent");
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("speaks of your account alone without a campaign (the campaigns page, CAMP-NEW-08)", () => {
    render(<FeedbackReportCard />);

    expect(screen.getByRole("region", { name: "Feedback and bug report" })).toHaveTextContent(
      "Send a report with your account so issues are easier to trace."
    );
  });

  it("shows api failures inline", async () => {
    sendFeedbackReport.mockRejectedValue(new Error("Too many requests"));

    render(<FeedbackReportCard />);

    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Report"), { target: { value: "Hit a bug" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Too many requests")).toBeInTheDocument();
  });
});
