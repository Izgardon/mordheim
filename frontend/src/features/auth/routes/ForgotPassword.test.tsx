/**
 * Pass 6 characterisation: the standalone forgot-password page at /forgot-password, which no
 * screen links to (the sign-in card has its own form). Decision 6 deletes it in PR C
 * (AUTH-TWEAK-06), so every test here flips then.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { RAIDER } from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { setupUser } from "@/test/user-event";
import ForgotPassword from "./ForgotPassword";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const RESET_SENT = "If an account exists for that email, a reset link has been sent.";
const THROTTLED = "Request was throttled. Expected available in 3540 seconds.";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route path="/" element={<p>Landing page</p>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>
    </MemoryRouter>
  );
}

async function requestReset() {
  const user = setupUser();
  renderPage();
  await user.type(screen.getByLabelText("Email"), RAIDER.email);
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
  return user;
}

beforeEach(() => {
  fakeApi.reset();
});

describe("ForgotPassword (AUTH-TWEAK-06, pinned; flips in PR C)", () => {
  it("renders its own card, with copy of its own (AUTH-TWEAK-06, pinned; flips in PR C)", () => {
    // Characterises current behaviour (AUTH-TWEAK-06, pinned; flips in PR C: the URL shows NotFound)
    renderPage();

    expect(screen.getByText("Recover your account")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enter the email you used to sign up. If we find a match, we will send a reset link."
      )
    ).toBeInTheDocument();
  });

  it("posts the address and shows the server's answer (BUG-56, AUTH-TWEAK-06, pinned; flips in PR C)", async () => {
    // Characterises current behaviour (AUTH-TWEAK-06, pinned; flips in PR C)
    fakeApi.on("POST /auth/password-reset/", { detail: RESET_SENT });

    await requestReset();

    expect(await screen.findByText(RESET_SENT)).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /auth/password-reset/")).toEqual({ email: RAIDER.email });
  });

  it("shows a refusal's message as the client built it (AUTH-UX-01, AUTH-TWEAK-06, pinned; flips in PR C)", async () => {
    // Characterises current behaviour (AUTH-TWEAK-06, pinned; flips in PR C)
    fakeApi.fail("POST /auth/password-reset/", new ApiError(THROTTLED, 429, { detail: THROTTLED }));

    await requestReset();

    expect(await screen.findByText(THROTTLED)).toBeInTheDocument();
  });

  it("links back to the sign-in page (AUTH-TWEAK-06, pinned; flips in PR C)", async () => {
    // Characterises current behaviour (AUTH-TWEAK-06, pinned; flips in PR C)
    const user = setupUser();
    renderPage();

    await user.click(screen.getByRole("link", { name: "Back to sign in" }));

    expect(screen.getByText("Landing page")).toBeInTheDocument();
  });
});
