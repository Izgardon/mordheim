// api
import { apiRequest } from "../../../lib/api-client";

// types
import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginCredentials,
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
  return apiRequest<AuthTokens>("/auth/login/", {
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




