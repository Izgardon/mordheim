// components
import { DataCredit, Disclaimer } from "@/components/ui/disclaimer";
import { GameIconsCredit } from "@/components/ui/game-icons";
import SitePage from "@/layouts/shell/SitePage";
import { cn } from "@/lib/utils";
import { AppearanceSection } from "../components/account/AppearanceSection";
import { DeleteAccountSection } from "../components/account/DeleteAccountSection";
import { DisplayNameSection } from "../components/account/DisplayNameSection";
import { PasswordSection } from "../components/account/PasswordSection";
import { SignOutOthersSection } from "../components/account/SignOutOthersSection";

// hooks
import { useAuth } from "../hooks/use-auth";

type AccountProps = {
  /**
   * Opened from inside a campaign (`/campaigns/:id/account`): the page sits in the campaign's
   * shell, so its rail or bottom nav stays, and the phone's top bar carries the title.
   */
  inCampaign?: boolean;
};

/**
 * Your account (AUTH-NEW-01, decision 1; design E): the display name others see, light or dark,
 * your password, signing out everywhere else, and deleting the account. Reached from the bar of
 * the campaigns page (`/account`), and inside a campaign from the rail's footer and the phone's
 * Me sheet.
 */
export default function Account({ inCampaign = false }: AccountProps) {
  const { user } = useAuth();
  const content = (
    <>
      <header className="flex flex-col gap-1.5 border-b border-line pb-6 max-[960px]:border-b-0 max-[960px]:pb-0">
        <h1
          className={cn(
            "m-0 font-display text-[40px] font-semibold leading-tight text-head max-[960px]:text-[30px]",
            inCampaign && "max-[960px]:hidden"
          )}
        >
          Account
        </h1>
        {user ? (
          <p className="m-0 break-words text-sm text-text2">{`Signed in as ${user.email}`}</p>
        ) : null}
      </header>
      <div className="grid gap-4">
        {user ? <DisplayNameSection key={user.id} user={user} /> : null}
        <AppearanceSection />
        <PasswordSection />
        <SignOutOthersSection />
        <DeleteAccountSection />
      </div>
      <div className="flex flex-col gap-1.5">
        <GameIconsCredit />
        <DataCredit />
        <Disclaimer />
      </div>
    </>
  );

  return inCampaign ? (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 pb-14 max-[960px]:gap-5 max-[960px]:pb-6 max-[960px]:pt-3">
      {content}
    </div>
  ) : (
    <SitePage width="narrow">{content}</SitePage>
  );
}
