import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Flag, House, LogOut, Search, Settings, Shield, Swords } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks/use-auth";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import SearchEverythingField from "@/features/search/components/SearchEverythingField";

import { REFERENCE_SECTIONS, mobileNavActiveId } from "../shell/campaign-nav";
import { BottomBar, BottomBarButton, BottomBarLink } from "./BottomBar";
import { SheetLinkRow, SheetRows } from "./SheetRows";

type CampaignBottomNavProps = {
  campaign: CampaignSummary;
  userName: string;
  /** A battle you can go back to: Battle goes there. */
  onRejoinBattle?: () => void;
  /**
   * With none to go back to, Battle opens Start a battle where you are (William: "battle in
   * bottom nav on mobile should just open the start a battle modal if not in one"). Left out (an
   * archived campaign), it goes to the Battles page.
   */
  onStartBattle?: () => void;
};

/** Battle while your battle waits: lit in the accent, its icon glowing and slowly pulsing. */
const REJOIN =
  "font-bold text-accent-hi [&_svg]:animate-pulse [&_svg]:drop-shadow-[0_0_6px_var(--color-accent)] motion-reduce:[&_svg]:animate-none";

/**
 * The phone's bottom nav (design E): Campaign, Warband, Battle, Reference, Settings. Flat; the
 * current item takes the accent and an inset top line. Reference and Settings open sheets: the
 * References and Rules sections, each under its heading (William: "on mobile just clearly
 * delineate the 2 sections in the dropdown but still keep as one navbar button"), and yours (the
 * campaign's settings and your account; William: "just show Settings and account in the Me modal
 * on mobile, not the my warband stuff"), which ends in Campaigns and Log out, the phone's only way
 * to either inside a campaign (William: "when clicked they're should be 2 buttons at bottom of
 * sheet. Campaigns and Log Out").
 */
export default function CampaignBottomNav({
  campaign,
  userName,
  onRejoinBattle,
  onStartBattle,
}: CampaignBottomNavProps) {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const [sheet, setSheet] = useState<"reference" | "settings" | null>(null);
  const active = mobileNavActiveId(pathname);
  const base = `/campaigns/${campaign.id}`;
  const close = () => setSheet(null);
  const onSheetChange = (which: "reference" | "settings") => (open: boolean) =>
    setSheet(open ? which : null);

  return (
    <>
      <BottomBar label="Main">
        <BottomBarLink to={base} label="Campaign" icon={Flag} current={active === "campaign"} />
        <BottomBarLink
          to={`${base}/warband`}
          label="Warband"
          icon={Shield}
          current={active === "warband"}
        />
        {onRejoinBattle ? (
          // your battle waits: Battle glows instead of a banner up top (William, 24 Nov 2026)
          <BottomBarButton
            label="Battle"
            icon={Swords}
            onClick={onRejoinBattle}
            aria-description="Your battle is waiting"
            className={REJOIN}
          />
        ) : onStartBattle ? (
          <BottomBarButton
            label="Battle"
            icon={Swords}
            current={active === "battle"}
            aria-haspopup="dialog"
            onClick={onStartBattle}
          />
        ) : (
          <BottomBarLink
            to={`${base}/battles`}
            label="Battle"
            icon={Swords}
            current={active === "battle"}
          />
        )}
        <BottomBarButton
          label="Reference"
          icon={Search}
          current={active === "reference"}
          aria-haspopup="dialog"
          onClick={() => setSheet("reference")}
        />
        <BottomBarButton
          label="Settings"
          icon={Settings}
          current={active === "settings"}
          aria-haspopup="dialog"
          onClick={() => setSheet("settings")}
        />
      </BottomBar>

      <BottomSheet
        open={sheet === "reference"}
        onOpenChange={onSheetChange("reference")}
        kicker={campaign.name}
        title="Reference"
      >
        <div className="flex flex-col gap-4">
          {REFERENCE_SECTIONS.map((section, index) => (
            <SheetRows key={section.title} label={section.title}>
              {index === 0 ? (
                <SearchEverythingField
                  campaignId={campaign.id}
                  onNavigate={close}
                  className="mx-1 mb-1.5 min-h-12"
                />
              ) : null}
              {section.links.map((link) => (
                <SheetLinkRow
                  key={link.path}
                  to={`${base}/${link.path}`}
                  label={link.label}
                  onNavigate={close}
                />
              ))}
            </SheetRows>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "settings"}
        onOpenChange={onSheetChange("settings")}
        kicker={userName}
        title="Settings"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" asChild>
              <Link to="/campaigns" onClick={close}>
                <House aria-hidden="true" />
                Home
              </Link>
            </Button>
            <Button variant="ghost" className="text-danger" onClick={signOut}>
              <LogOut aria-hidden="true" />
              Log out
            </Button>
          </div>
        }
      >
        <SheetRows>
          <SheetLinkRow to={`${base}/settings`} label="Campaign settings" onNavigate={close} />
          <SheetLinkRow to={`${base}/account`} label="Account" onNavigate={close} />
        </SheetRows>
      </BottomSheet>
    </>
  );
}
