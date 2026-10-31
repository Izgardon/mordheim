// components
import SitePage from "@/layouts/shell/SitePage";
import { DeleteAccountSection } from "../components/account/DeleteAccountSection";
import { DisplayNameSection } from "../components/account/DisplayNameSection";
import { PasswordSection } from "../components/account/PasswordSection";
import { SignOutOthersSection } from "../components/account/SignOutOthersSection";

// hooks
import { useAuth } from "../hooks/use-auth";

/**
 * Your account (AUTH-NEW-01, decision 1; design E): the display name others see, your password,
 * signing out everywhere else, and deleting the account. Reached from the bar of the campaigns
 * page, the rail's footer and the phone's Me sheet.
 */
export default function Account() {
  const { user } = useAuth();

  return (
    <SitePage width="narrow">
      <header className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          Your account
        </span>
        <h1 className="m-0 font-display text-[40px] font-semibold leading-tight text-head max-[960px]:text-[30px]">
          Account
        </h1>
        {user ? (
          <p className="m-0 break-words text-sm text-text2">{`Signed in as ${user.email}`}</p>
        ) : null}
      </header>
      <div className="grid gap-4">
        {user ? <DisplayNameSection key={user.id} user={user} /> : null}
        <PasswordSection />
        <SignOutOthersSection />
        <DeleteAccountSection />
      </div>
    </SitePage>
  );
}
