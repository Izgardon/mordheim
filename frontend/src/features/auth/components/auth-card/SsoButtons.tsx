// components
import { Button } from "@components/button";
import { AuthFormError } from "../AuthField";

// hooks
import { useSsoProviders, useSsoRedirect } from "../../hooks/use-sso";

// other
import { ProviderMark } from "./provider-marks";

/**
 * Sign in with Google or Discord, under both the sign-in and the create-account forms: the same
 * button does both, because a provider account either reaches an account or makes one.
 *
 * Only providers the server says are set up are listed, so a half-configured deploy shows nothing
 * rather than a button that can't work.
 */
export function SsoButtons({ action }: { action: "Sign in" | "Continue" }) {
  const { data } = useSsoProviders();
  const redirect = useSsoRedirect();
  const providers = data?.providers ?? [];

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {providers.map((provider) => (
        <Button
          key={provider.slug}
          type="button"
          variant="secondary"
          className="h-12 w-full text-[15px]"
          disabled={redirect.pending !== null}
          onClick={() => redirect.begin(provider.slug)}
        >
          <ProviderMark slug={provider.slug} />
          {redirect.pending === provider.slug ? "Working..." : `${action} with ${provider.label}`}
        </Button>
      ))}
      <AuthFormError message={redirect.error} />
    </div>
  );
}
