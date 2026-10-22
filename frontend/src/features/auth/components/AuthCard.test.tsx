/**
 * The sign-in card as the landing page shows it, with the real AuthProvider over the fake API
 * server. Sign-in, sign-up with its display name, the inline forgot-password form, the mode
 * switch, the password toggle and the redirect. What the card shows for each refusal is in
 * AuthCard.errors.test.tsx.
 */
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/features/auth/stores/auth-store";
import { ApiError } from "@/lib/api-client";
import { deferred, loginAnswer, RAIDER, registerAnswer, storeSession } from "@/test/auth-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createQueryWrapper } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import AuthCard from "./AuthCard";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", () => ({ disconnectRealtime: vi.fn() }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const RESET_SENT = "If an account exists for that email, a reset link has been sent.";
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

/** The form's submit button (the mode switch has a "Sign in" button too). */
const submitButton = () =>
  screen.getAllByRole("button").find((button) => button.getAttribute("type") === "submit")!;

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
});

describe("signing in", () => {
  it("sends what was typed, says Working... meanwhile, then goes to /campaigns", async () => {
    const user = setupUser();
    const login = deferred<ReturnType<typeof loginAnswer>>();
    fakeApi.on("POST /auth/login/", () => login.promise);
    fakeApi.on("GET /auth/me/", RAIDER);
    renderCard();

    await user.type(screen.getByLabelText("Email"), "Raider@Example.com");
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    expect(submitButton()).toHaveTextContent("Working...");
    expect(submitButton()).toBeDisabled();
    expect(fakeApi.bodyOf("POST /auth/login/")).toEqual({
      email: "Raider@Example.com",
      password: "wyrdstone",
    });

    await act(async () => login.resolve(loginAnswer(RAIDER)));

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
  });

  it("announces a refusal under the form as an alert (AUTH-UX-07)", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /auth/login/",
      new ApiError("Invalid credentials", 400, { non_field_errors: ["Invalid credentials"] })
    );
    renderCard();

    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(submitButton()).toHaveTextContent("Sign in");
  });

  it("sends a visitor who is already signed in on to /campaigns", async () => {
    storeSession();
    fakeApi.on("GET /auth/me/", RAIDER);
    renderCard();

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(fakeApi.calls()).toEqual(["GET /auth/me/"]);
  });
});

describe("creating an account", () => {
  it("asks for a display name, required and up to 40 characters, and sends it (decision 2, AUTH-TWEAK-01)", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/register/", registerAnswer(RAIDER));
    renderCard();

    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Display name")).toHaveAttribute("maxlength", "40");
    expect(screen.queryByLabelText("Alias")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toBeRequired();
    expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password");
    // No password-rules hint (AUTH-TWEAK-07).
    expect(screen.queryByText(/at least 8 characters/i)).toBeNull();

    await user.type(screen.getByLabelText("Display name"), "Raider");
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    expect(await screen.findByText("Campaigns page")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /auth/register/")).toEqual({
      name: "Raider",
      email: RAIDER.email,
      password: "wyrdstone",
    });
  });

  it("sends no sign-up without a display name (decision 2, AUTH-TWEAK-01)", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/register/", registerAnswer(RAIDER));
    renderCard();

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.type(screen.getByLabelText("Password"), "wyrdstone");
    await user.click(submitButton());

    expect(fakeApi.calls()).toEqual([]);
    expect(screen.getByLabelText("Display name")).toBeInvalid();
  });

  it("marks the chosen mode with aria-pressed, not by colour alone (AUTH-UX-07)", async () => {
    const user = setupUser();
    renderCard();
    const signInSwitch = () => screen.getAllByRole("button", { name: "Sign in" })[0];
    const createSwitch = () => screen.getByRole("button", { name: "Create Account" });

    expect(signInSwitch()).toHaveAttribute("aria-pressed", "true");
    expect(createSwitch()).toHaveAttribute("aria-pressed", "false");
    await user.click(createSwitch());

    expect(createSwitch()).toHaveAttribute("aria-pressed", "true");
    expect(signInSwitch()).toHaveAttribute("aria-pressed", "false");
    expect(submitButton()).toHaveTextContent("Create account");

    await user.click(signInSwitch());
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(signInSwitch()).toHaveAttribute("aria-pressed", "false");
    expect(createSwitch()).toHaveAttribute("aria-pressed", "false");
  });
});

describe("the password toggle", () => {
  it("shows the password on either form and hides it again on a mode change", async () => {
    const user = setupUser();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Show password" })).toBeInTheDocument();
  });
});

describe("the inline forgot-password form", () => {
  it("is a button, not a link to /forgot-password, and posts only the address typed into it", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/password-reset/", { detail: RESET_SENT });
    renderCard();
    await user.type(screen.getByLabelText("Email"), "typed-for-sign-in@example.com");

    expect(screen.queryByRole("link", { name: /forgot/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(screen.getByLabelText("Email")).toHaveValue("");
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(fakeApi.calls()).toEqual(["POST /auth/password-reset/"]);
    expect(fakeApi.bodyOf("POST /auth/password-reset/")).toEqual({ email: RAIDER.email });
  });

  it("with email off, says so and who can reset the password, as the server's 503 email_unavailable does, instead of 'a reset link has been sent' (BUG-56)", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /auth/password-reset/",
      new ApiError(EMAIL_OFF, 503, { detail: EMAIL_OFF, code: "email_unavailable", fields: {} })
    );
    renderCard();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(EMAIL_OFF);
    expect(screen.queryByText(RESET_SENT)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("with email on, shows the server's answer, which Back to sign in clears", async () => {
    const user = setupUser();
    fakeApi.on("POST /auth/password-reset/", { detail: RESET_SENT });
    renderCard();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText(RESET_SENT)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.queryByText(RESET_SENT)).toBeNull();
    expect(submitButton()).toHaveTextContent("Sign in");
  });

  it("says Sending... while the request is out", async () => {
    const user = setupUser();
    const reset = deferred<{ detail: string }>();
    fakeApi.on("POST /auth/password-reset/", () => reset.promise);
    renderCard();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    await user.type(screen.getByLabelText("Email"), RAIDER.email);
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
    await act(async () => reset.resolve({ detail: RESET_SENT }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled()
    );
  });
});
