/**
 * Pass 6 characterisation: the feedback card's length limit (AUTH-TEST-29), with the real
 * dialog over the fake API server. The server caps a report at 2000 characters; the card
 * doesn't know.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";
import FeedbackReportCard from "./FeedbackReportCard";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const TOO_LONG = "Ensure this field has no more than 2000 characters.";

beforeEach(() => {
  fakeApi.reset();
});

describe("FeedbackReportCard length (AUTH-TEST-29)", () => {
  it("takes 2,001 characters with no maxLength or counter, sends them all and shows the server's refusal (AUTH-TEST-29, AUTH-UX-04, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-04, pinned; flips in PR A: maxLength={2000} and a counter)
    const user = setupUser();
    fakeApi.fail(
      "POST /auth/feedback-report/",
      new ApiError(TOO_LONG, 400, { message: [TOO_LONG] })
    );
    render(<FeedbackReportCard />);

    await user.click(screen.getByRole("button", { name: "Send report" }));
    const dialog = screen.getByRole("dialog");
    const report = within(dialog).getByLabelText("Report");
    fireEvent.change(report, { target: { value: "x".repeat(2001) } });

    expect(report).not.toHaveAttribute("maxlength");
    expect(report).toHaveValue("x".repeat(2001));
    expect(within(dialog).queryByText(/2,?00[01]/)).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    const body = fakeApi.bodyOf("POST /auth/feedback-report/") as { message: string };
    expect(body.message).toHaveLength(2001);
    expect(await within(dialog).findByText(`Message: ${TOO_LONG}`)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(report).toHaveValue("x".repeat(2001));
  });
});
