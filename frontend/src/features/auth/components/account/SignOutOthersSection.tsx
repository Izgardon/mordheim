// components
import { Button } from "@components/button";
import { AuthFormError } from "../AuthField";
import { AccountSection } from "./AccountSection";

// hooks
import { useSignOutOthers } from "../../hooks/use-account-sessions";

/** Sign out everywhere else (AUTH-NEW-04): one button; this device stays signed in. */
export function SignOutOthersSection() {
  const { signOutOthers, isSigningOut, error } = useSignOutOthers();

  return (
    <AccountSection
      title="Sign out everywhere else"
      description="Signs you out on every other browser and device. This one stays signed in."
    >
      <AuthFormError message={error} />
      <Button
        variant="secondary"
        size="sm"
        disabled={isSigningOut}
        onClick={() => void signOutOthers()}
      >
        {isSigningOut ? "Signing out..." : "Sign out everywhere else"}
      </Button>
    </AccountSection>
  );
}
