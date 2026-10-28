/**
 * The text the sign-in card shows for each refusal (AUTH-TEST-26). The real `apiRequest` builds
 * the error from a fake `fetch`, and the card reads it through `getErrorMessage` (AUTH-UX-01),
 * as an alert (AUTH-UX-07).
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PASSWORD_HINT } from "@/features/auth/components/PasswordInput";
import { AuthProvider } from "@/features/auth/stores/auth-store";
import { ApiError, SERVER_UNAVAILABLE_MESSAGE } from "@/lib/api-client";
import { getErrorMessage, SERVER_ERROR_MESSAGE } from "@/lib/get-error-message";
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
  await user.type(screen.getByLabelText("Display name"), "Raider");
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
  it("says when to try again after a throttle, in minutes, not DRF's seconds (AUTH-TEST-26, AUTH-UX-01)", async () => {
    fakeFetch.on("POST /auth/login/", json(429, { detail: THROTTLED }, { "Retry-After": "3540" }));

    await signIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts. Try again in 59 minutes."
    );
    expect(screen.queryByText(THROTTLED)).toBeNull();
  });

  it("says the server can't be reached instead of 'Failed to fetch' (AUTH-TEST-26, AUTH-UX-01)", async () => {
    fakeFetch.on("POST /auth/login/", () => {
      throw new TypeError("Failed to fetch");
    });

    await signIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(SERVER_UNAVAILABLE_MESSAGE);
  });

  it("shows both password rules a sign-up breaks, under the password (AUTH-TEST-26, AUTH-UX-01, BUG-171)", async () => {
    fakeFetch.on("POST /auth/register/", json(400, { password: [TOO_SHORT, TOO_COMMON] }));

    await signUp();

    expect(await screen.findByRole("alert")).toHaveTextContent(`${TOO_SHORT} ${TOO_COMMON}`);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      `${PASSWORD_HINT} ${TOO_SHORT} ${TOO_COMMON}` // the rules hint, then the refusal
    );
  });

  it("shows a plain sentence for a server error, as the over-long alias gets (BUG-84, AUTH-UX-01)", async () => {
    fakeFetch.on(
      "POST /auth/register/",
      () =>
        new Response("<h1>Server Error (500)</h1>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
    );

    await signUp();

    expect(await screen.findByRole("alert")).toHaveTextContent(SERVER_ERROR_MESSAGE);
    expect(screen.queryByText("Request failed (500)")).toBeNull();
  });

  it("shows the server's refusal of a display name of spaces, which the browser lets through, under the field it names (decision 2, BUG-171)", async () => {
    const user = setupUser();
    fakeFetch.on("POST /auth/register/", json(400, { name: ["This field may not be blank."] }));
    renderCard();

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await user.type(screen.getByLabelText("Display name"), "   ");
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    // Was "Name: This field may not be blank." under the form, under a field labelled "Display
    // name" (BUG-171)
    expect(await screen.findByRole("alert")).toHaveTextContent(/^This field may not be blank\.$/);
    expect(screen.getByLabelText("Display name")).toHaveAccessibleDescription(
      "This field may not be blank."
    );
    expect(screen.queryByText(/Name:/)).toBeNull();
    expect(fakeFetch.requests()[0].body).toMatchObject({ name: "   " });
  });

  it("shows the server's new password rule, a password too like the email, under the password (AUTH-CQ-04, BUG-171)", async () => {
    fakeFetch.on(
      "POST /auth/register/",
      json(400, { password: ["The password is too similar to the email address."] })
    );

    await signUp();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^The password is too similar to the email address\.$/
    );
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      `${PASSWORD_HINT} The password is too similar to the email address.`
    );
  });

  it("shows login's refusal of an address the browser accepts but the server doesn't (IMP-95 a)", async () => {
    const user = setupUser();
    fakeFetch.on("POST /auth/login/", json(400, { email: ["Enter a valid email address."] }));
    renderCard();

    await user.type(screen.getByLabelText("Email"), "raider@wyrdstone");
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email: Enter a valid email address."
    );
  });

  it("says a taken email is taken, under the email (SEC-11, accepted; BUG-171)", async () => {
    fakeFetch.on("POST /auth/register/", json(400, { email: ["User already exists"] }));

    await signUp();

    expect(await screen.findByRole("alert")).toHaveTextContent(/^User already exists$/);
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("User already exists");
  });

  it("shows login's 'Invalid credentials' and stores no session", async () => {
    fakeFetch.on("POST /auth/login/", json(400, { non_field_errors: ["Invalid credentials"] }));

    await signIn();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(fakeFetch.calls()).toEqual(["POST /auth/login/"]);
    expect(localStorage.length).toBe(0);
  });
});

describe("a refusal on the forgot-password form", () => {
  it("shows a 503's detail as sent, and getErrorMessage keeps it too (BUG-56)", async () => {
    // PR A answers 503 email_unavailable with this detail and moves the card to getErrorMessage,
    // which reads a 503 the server sent on purpose by its detail, not as "Can't reach the server".
    const user = setupUser();
    fakeFetch.on(
      "POST /auth/password-reset/",
      json(503, { detail: EMAIL_OFF, code: "email_unavailable" })
    );
    renderCard();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(EMAIL_OFF);
    const sameError = new ApiError(EMAIL_OFF, 503, {
      detail: EMAIL_OFF,
      code: "email_unavailable",
    });
    expect(getErrorMessage(sameError)).toBe(EMAIL_OFF);
  });
});
