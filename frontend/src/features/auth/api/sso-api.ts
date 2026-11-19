// api
import { apiRequest } from "@/lib/api-client";

// types
import type { AuthResponse, SsoCallbackPayload, SsoProvider, SsoStart } from "../types/auth-types";

/**
 * Social sign-in. The browser never holds a client id or secret: it asks the server for the
 * authorize URL, and the server exchanges the code it brings back.
 */

/** The providers this deploy has set up; an unconfigured one isn't listed, so no dead button shows. */
export function fetchSsoProviders(signal?: AbortSignal) {
  return apiRequest<{ providers: SsoProvider[] }>("/auth/sso/providers/", {
    token: null,
    signal,
  });
}

/** Begins an attempt: the authorize URL to navigate to, and the state and secret to send back. */
export function startSso(provider: string) {
  return apiRequest<SsoStart>(`/auth/sso/${provider}/start/`, { token: null });
}

/** Finishes an attempt; answers the token pair and the user, as sign-in does. */
export function completeSso(provider: string, payload: SsoCallbackPayload) {
  return apiRequest<AuthResponse>(`/auth/sso/${provider}/callback/`, {
    method: "POST",
    body: payload,
    token: null,
  });
}
