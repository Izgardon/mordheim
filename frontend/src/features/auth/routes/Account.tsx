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
import siteBackground from "@/assets/background/campaign_background.webp";
import "@/features/campaigns/styles/campaigns.css";

/**
 * Your account (AUTH-NEW-01, decision 1): the display name others see, your password, signing
 * out everywhere else, and deleting the account. Linked from the campaigns list beside Log out
 * and from a campaign's Settings → Personal.
 */
export default function Account() {
  const { user, signOut } = useAuth();

  return (
    <main
      className="campaigns h-screen overflow-x-hidden overflow-y-auto px-4 py-8 sm:px-6 sm:py-12"
      style={{
        backgroundImage: `linear-gradient(rgba(6, 5, 4, 0.25), rgba(6, 5, 4, 0.25)), url(${siteBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to="/campaigns">Campaigns</Link>
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={signOut}
          >
            Log out
          </Button>
        </div>
        <header className="campaign-list-shell campaign-list-shell--flat space-y-2 p-4 sm:p-6">
          <h1 className="text-base font-semibold text-foreground sm:text-lg md:text-xl">Account</h1>
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
