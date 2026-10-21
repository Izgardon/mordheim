/**
 * Pass 6 characterisation: the text the sign-in card shows for each refusal (AUTH-TEST-26).
 * The real `apiRequest` builds the message from a fake `fetch`, so these are the words a user
 * reads today: the card prints `error.message` and doesn't use `getErrorMessage`.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/features/auth/stores/auth-store";
import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/get-error-message";
import { RAIDER } from "@/test/auth-fixtures";
import { fakeFetch, json } from "@/test/fake-fetch";
import { createQueryWrapper } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AuthCard from "./AuthCard";

vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const THROTTLED = "Request was throttled. Expected available in 3540 seconds.";
const TOO_SHORT = "This password is too short. It must contain at least 8 characters.";
const TOO_COMMON = "This password is too common.";
const EMAIL_OFF =
  "Password reset by email isn't switched on yet. Ask the app's admin to reset your password.";

function renderCard() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<AuthCard />} />
          <Route path="/campaigns" element={<p>Campaigns page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
    { wrapper: createQueryWrapper() }
  );
}

const submitButton = () =>
  screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit")!;

async function signIn() {
  const user = setupUser();
  renderCard();
  await user.type(screen.getByLabelText("Email"), RAIDER.email);
  await user.type(screen.getByLabelText("Password"), "wyrdstone");
  await user.click(submitButton());
}

async function signUp() {
  const user = setupUser();
  renderCard();
  await user.click(screen.getByRole("button", { name: "Create Account" }));
  await user.type(screen.getByLabelText("Alias"), "Raider");
  await user.type(screen.getByLabelText("Email"), RAIDER.email);
  await user.type(screen.getByLabelText("Password"), "password");
  await user.click(submitButton());
}

beforeEach(() => {
  localStorage.clear();
  fakeFetch.install();
});

afterEach(() => {
  fakeFetch.uninstall();
});

describe("refusals on the sign-in card (AUTH-TEST-26)", () => {
  it("shows DRF's throttle text in seconds, Retry-After unread (AUTH-TEST-26, AUTH-UX-01, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-01, pinned; flips in PR A: getErrorMessage)
    fakeFetch.on("POST /auth/login/", json(429, { detail: THROTTLED }, { "Retry-After": "3540" }));

    await signIn();

    expect(await screen.findByText(THROTTLED)).toBeInTheDocument();
  });

  it("shows the browser's 'Failed to fetch' when the server can't be reached (AUTH-TEST-26, AUTH-UX-01, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-01, pinned; flips in PR A)
    fakeFetch.on("POST /auth/login/", () => {
      throw new TypeError("Failed to fetch");
    });

    await signIn();

    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
  });

  it("shows only the first of two password rules a sign-up breaks (AUTH-TEST-26, AUTH-UX-01, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (AUTH-UX-01, pinned; flips in PR A)
    fakeFetch.on("POST /auth/register/", json(400, { password: [TOO_SHORT, TOO_COMMON] }));

    await signUp();

    expect(await screen.findByText(TOO_SHORT)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(TOO_COMMON))).toBeNull();
  });

  it("shows 'Request failed (500)' for a server error, as the over-long alias gets (BUG-84, pinned; flips in PR A)", async () => {
    // Characterises current behaviour (BUG-84, AUTH-UX-01, pinned; flips in PR A)
    fakeFetch.on(
      "POST /auth/register/",
      () =>
        new Response("<h1>Server Error (500)</h1>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
    );

    await signUp();

    expect(await screen.findByText("Request failed (500)")).toBeInTheDocument();
  });

  it("says a taken email is taken (SEC-11, accepted)", async () => {
    fakeFetch.on("POST /auth/register/", json(400, { email: ["User already exists"] }));

    await signUp();

    expect(await screen.findByText("User already exists")).toBeInTheDocument();
  });

  it("shows login's 'Invalid credentials' and stores no session", async () => {
    fakeFetch.on("POST /auth/login/", json(400, { non_field_errors: ["Invalid credentials"] }));

    await signIn();

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(fakeFetch.calls()).toEqual(["POST /auth/login/"]);
    expect(localStorage.length).toBe(0);
  });
});

describe("a refusal on the forgot-password form", () => {
  it("shows a 503's detail as sent, which getErrorMessage would replace with the outage text (BUG-56; a PR A trap)", async () => {
    // PR A answers 503 email_unavailable with this detail and moves the card to getErrorMessage,
    // which reads every 503 as "Can't reach the server" and drops the detail.
    const user = setupUser();
    fakeFetch.on(
      "POST /auth/password-reset/",
      json(503, { detail: EMAIL_OFF, code: "email_unavailable" })
    );
    renderCard();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(EMAIL_OFF)).toBeInTheDocument();
    const sameError = new ApiError(EMAIL_OFF, 503, {
      detail: EMAIL_OFF,
      code: "email_unavailable",
    });
    expect(getErrorMessage(sameError)).toBe(SERVER_UNAVAILABLE_MESSAGE);
  });
});
