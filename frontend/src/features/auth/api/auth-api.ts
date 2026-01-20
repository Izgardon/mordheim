import { apiRequest } from "../../../lib/api-client";
import type { AuthResponse, AuthTokens, AuthUser, LoginCredentials, RegisterPayload } from "../types/auth-types";

export function registerAccount(payload: RegisterPayload) {
  return apiRequest<AuthResponse>("/auth/register/", {
    method: "POST",
    body: payload,
  });
}

export function loginAccount(payload: LoginCredentials) {
  return apiRequest<AuthTokens>("/auth/login/", {
    method: "POST",
    body: payload,
  });
}

export function fetchMe(token: string) {
  return apiRequest<AuthUser>("/auth/me/", {
    token,
  });
}
