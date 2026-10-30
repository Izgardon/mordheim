import { Link } from "react-router-dom";

// components
import { Button } from "@components/button";
import { DeleteAccountSection } from "../components/account/DeleteAccountSection";
import { DisplayNameSection } from "../components/account/DisplayNameSection";
import { PasswordSection } from "../components/account/PasswordSection";
import { SignOutOthersSection } from "../components/account/SignOutOthersSection";

// hooks
import { useAuth } from "../hooks/use-auth";

// other

/**
 * Your account (AUTH-NEW-01, decision 1): the display name others see, your password, signing
 * out everywhere else, and deleting the account. Linked from the campaigns list beside Log out
 * and from a campaign's Settings → Personal.
 */
export default function Account() {
  const { user, signOut } = useAuth();

  return (
    <main className="h-screen overflow-x-hidden overflow-y-auto bg-page px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/campaigns">Campaigns</Link>
          </Button>
          <Button variant="ghost" className="text-danger hover:text-danger" onClick={signOut}>
            Log out
          </Button>
        </div>
        <header className="space-y-2 border border-border bg-surface p-4 sm:p-6">
          <h1 className="font-display text-3xl font-semibold text-head">Account</h1>
          {user ? (
            <p className="break-words text-sm text-muted-foreground">{`Signed in as ${user.email}`}</p>
          ) : null}
        </header>
        {user ? <DisplayNameSection key={user.id} user={user} /> : null}
        <PasswordSection />
        <SignOutOthersSection />
        <DeleteAccountSection />
      </div>
    </main>
  );
}
