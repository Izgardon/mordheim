import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

// api
import { completeSso, fetchSsoProviders, startSso } from "../api/sso-api";

// utils
import { queryKeys } from "@/lib/query-keys";
import { getRefusalMessage } from "@/lib/get-error-message";
import { leaveForProvider } from "../utils/leave-for-provider";
import { rememberSsoAttempt, takeSsoAttempt } from "../utils/sso-attempt";

// types
import type { AuthResponse } from "../types/auth-types";

const START_FAILED = "Couldn't start that sign-in. Please try again.";
const SIGN_IN_FAILED = "That sign-in couldn't be completed. Please try again.";
export const NO_ATTEMPT =
  "This sign-in didn't start in this tab. Go back to the sign-in page and try again.";
export const CANCELLED = "That sign-in was cancelled.";

/** The providers the sign-in card may offer. Book-like data: read once and kept. */
export function useSsoProviders() {
  return useQuery({
    queryKey: queryKeys.ssoProviders(),
    queryFn: ({ signal }) => fetchSsoProviders(signal),
    staleTime: Infinity,
    retry: false,
  });
}

/**
 * Pressing a provider's button: the server hands back the authorize URL, this browser keeps the
 * attempt's secret, and the page leaves for the provider. The button stays busy until it does.
 */
export function useSsoRedirect() {
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (slug: string) => startSso(slug),
    onSuccess: (start, slug) => {
      rememberSsoAttempt({ provider: slug, state: start.state, browserToken: start.browser_token });
      leaveForProvider(start.authorize_url);
    },
    onError: (failure) => {
      setProvider(null);
      setError(getRefusalMessage(failure, START_FAILED));
    },
  });

  return {
    error,
    /** Which provider's button is waiting, so only that one shows it. */
    pending: provider,
    begin: (slug: string) => {
      setError("");
      setProvider(slug);
      mutation.mutate(slug);
    },
  };
}

/** What the callback route is doing: exchanging the code, or the one line to show instead. */
export type SsoCallbackState = {
  isWorking: boolean;
  error: string;
  data: AuthResponse | undefined;
};

/**
 * The callback route's exchange. The attempt is read from this browser once (so a reload can't
 * replay it), and the code goes to the server, which holds the client secret and the PKCE
 * verifier. `providerError` is the provider's own `?error=` (a cancelled consent), which never
 * reaches the server.
 */
export function useSsoCallback(
  provider: string,
  code: string,
  providerError: string
): SsoCallbackState {
  // Read once per mount, before the query runs: the secret leaves sessionStorage either way.
  const [attempt] = useState(takeSsoAttempt);
  const mismatched = !attempt || attempt.provider !== provider || !code;
  const refusedBefore = providerError ? CANCELLED : mismatched ? NO_ATTEMPT : "";

  const query = useQuery({
    queryKey: ["sso-callback", provider, attempt?.state ?? "", code],
    queryFn: () =>
      completeSso(provider, {
        code,
        state: attempt?.state ?? "",
        browser_token: attempt?.browserToken ?? "",
      }),
    enabled: !refusedBefore,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    isWorking: !refusedBefore && query.isPending,
    error: refusedBefore || (query.error ? getRefusalMessage(query.error, SIGN_IN_FAILED) : ""),
    data: query.data,
  };
}
