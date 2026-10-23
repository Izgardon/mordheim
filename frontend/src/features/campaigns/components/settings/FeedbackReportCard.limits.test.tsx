/**
 * The feedback card's length limit (AUTH-TEST-29), with the real dialog over the fake API
 * server. The server caps a report at 2000 characters, and so does the card, with a counter.
 */
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";
import FeedbackReportCard from "./FeedbackReportCard";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

beforeEach(() => {
  fakeApi.reset();
});

describe("FeedbackReportCard length (AUTH-TEST-29)", () => {
  it("stops a report at 2,000 characters, counts them as you go, and sends what fits (AUTH-TEST-29, AUTH-UX-04)", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/feedback-report/", { detail: "Feedback report sent." });
    render(<FeedbackReportCard />);

    await user.click(screen.getByRole("button", { name: "Send report" }));
    const dialog = screen.getByRole("dialog");
    const report = within(dialog).getByLabelText("Report");
    expect(report).toHaveAttribute("maxlength", "2000");
    expect(report).toHaveAccessibleDescription("0/2000 characters");

    await user.click(report);
    await user.paste("x".repeat(2001));

    expect(report).toHaveValue("x".repeat(2000));
    expect(report).toHaveAccessibleDescription("2000/2000 characters");

    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    const body = fakeApi.bodyOf("POST /auth/feedback-report/") as { message: string };
    expect(body.message).toHaveLength(2000);
    expect(await screen.findByRole("status")).toHaveTextContent("Thanks, report sent");
  });
});
