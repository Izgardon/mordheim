// api
import { apiRequest } from "../../../lib/api-client";

// types
import type {
  AuthResponse,
  FeedbackReportPayload,
  AuthUser,
  LoginCredentials,
  PasswordChangePayload,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  RegisterPayload,
} from "../types/auth-types";

export function registerAccount(payload: RegisterPayload) {
  return apiRequest<AuthResponse>("/auth/register/", {
    method: "POST",
    body: payload,
    token: null,
  });
}

export function loginAccount(payload: LoginCredentials) {
  return apiRequest<AuthResponse>("/auth/login/", {
    method: "POST",
    body: payload,
    token: null,
  });
}

export function fetchMe(token: string) {
  return apiRequest<AuthUser>("/auth/me/", {
    token,
  });
}

/** Changes the display name; the server trims it and answers the user (AUTH-NEW-02). */
export function renameAccount(name: string) {
  return apiRequest<AuthUser>("/auth/me/", { method: "PATCH", body: { name } });
}

/** Changes the password: every other device is signed out; this one gets a fresh pair (AUTH-NEW-03). */
export function changePassword(payload: PasswordChangePayload) {
  return apiRequest<AuthResponse>("/auth/password/", { method: "POST", body: payload });
}

/** Signs out every other device; this one gets a fresh pair (AUTH-NEW-04). */
export function signOutOtherSessions() {
  return apiRequest<AuthResponse>("/auth/sign-out-others/", { method: "POST" });
}

export function requestPasswordReset(payload: PasswordResetRequestPayload) {
  return apiRequest<{ detail: string }>("/auth/password-reset/", {
    method: "POST",
    body: payload,
    token: null,
  });
}

export function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  return apiRequest<{ detail: string }>("/auth/password-reset-confirm/", {
    method: "POST",
    body: payload,
    token: null,
  });
}

export function sendFeedbackReport(payload: FeedbackReportPayload) {
  return apiRequest<{ detail: string }>("/auth/feedback-report/", {
    method: "POST",
    body: payload,
  });
}
