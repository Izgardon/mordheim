import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

// components
import { Button } from "@components/button";
import { AUTH_TEXT_ACTION, AuthFormError } from "../components/AuthField";
import AuthShell, { AuthHeading } from "../components/AuthShell";

// hooks
import { useSsoCallback } from "../hooks/use-sso";
import { useAuth } from "../hooks/use-auth";

// utils
import { returnPathFrom } from "../utils/sign-in-redirect";

/**
 * Where a provider sends the player back: `/auth/callback/:provider?code=…&state=…`.
 *
 * The code is posted to the server, which holds the client secret and the PKCE verifier, and the
 * answer is the same token pair a password sign-in gets. The provider's own `?error=` (a
 * cancelled consent screen) never reaches the server.
 */
export default function SsoCallback() {
  const { provider = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const { isWorking, error, data } = useSsoCallback(
    provider,
    params.get("code") ?? "",
    params.get("error") ?? ""
  );

  useEffect(() => {
    if (data) {
      adoptSession(data);
      // The trip to the provider is a full navigation, so no redirect state survives it.
      navigate(returnPathFrom(null), { replace: true });
    }
  }, [data, adoptSession, navigate]);

  return (
    <AuthShell>
      <AuthHeading kicker="Mordheim Chronicler" title={error ? "Sign-in failed" : "Signing you in"}>
        {isWorking ? (
          <p role="status" className="m-0 text-[15px] text-text2">
            Finishing your sign-in...
          </p>
        ) : null}
      </AuthHeading>
      <AuthFormError message={error} />
      {error ? (
        <div className="flex flex-col gap-3">
          <Button asChild className="h-12 w-full text-[15px]">
            <Link to="/">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <Link to="/" className={AUTH_TEXT_ACTION}>
          Back to sign in
        </Link>
      )}
    </AuthShell>
  );
}
