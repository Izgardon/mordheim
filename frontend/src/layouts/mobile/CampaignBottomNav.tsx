import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Flag, Search, Shield, Swords, UserRound } from "lucide-react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";

import { REFERENCE_LINKS, SEARCH_LINK, mobileNavActiveId } from "../shell/campaign-nav";
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

/**
 * The phone's bottom nav (design E): Campaign, Warband, Battle, Reference, Me. Flat; the current
 * item takes the accent and an inset top line. Reference and Me open sheets: the reference pages,
 * and you (the campaign's settings and your account; William: "just show Settings and account in
 * the Me modal on mobile, not the my warband stuff").
 */
export default function CampaignBottomNav({
  campaign,
  userName,
  onRejoinBattle,
  onStartBattle,
}: CampaignBottomNavProps) {
  const { pathname } = useLocation();
  const [sheet, setSheet] = useState<"reference" | "me" | null>(null);
  const active = mobileNavActiveId(pathname);
  const base = `/campaigns/${campaign.id}`;
  const close = () => setSheet(null);
  const onSheetChange = (which: "reference" | "me") => (open: boolean) =>
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
          <BottomBarButton label="Battle" icon={Swords} onClick={onRejoinBattle} />
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
          label="Me"
          icon={UserRound}
          current={active === "me"}
          aria-haspopup="dialog"
          onClick={() => setSheet("me")}
        />
      </BottomBar>

      <BottomSheet
        open={sheet === "reference"}
        onOpenChange={onSheetChange("reference")}
        kicker={campaign.name}
        title="Reference"
      >
        <SheetRows>
          <SheetLinkRow
            to={`${base}/${SEARCH_LINK.path}`}
            label={SEARCH_LINK.label}
            onNavigate={close}
          />
          {REFERENCE_LINKS.map((link) => (
            <SheetLinkRow
              key={link.path}
              to={`${base}/${link.path}`}
              label={link.label}
              onNavigate={close}
            />
          ))}
        </SheetRows>
      </BottomSheet>

      <BottomSheet
        open={sheet === "me"}
        onOpenChange={onSheetChange("me")}
        kicker={userName}
        title="Me"
      >
        <SheetRows>
          <SheetLinkRow to={`${base}/settings`} label="Settings" onNavigate={close} />
          <SheetLinkRow to={`${base}/account`} label="Account" onNavigate={close} />
        </SheetRows>
      </BottomSheet>
    </>
  );
}
