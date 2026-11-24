import type { CampaignSummary } from "@/features/campaigns/types/campaign-types";
import type { Item } from "@/features/items/types/item-types";

import type { useWarbandSheet } from "../../hooks/warband/useWarbandSheet";
import type { Warband } from "../../types/warband-types";
import EditUnitForm from "../roster/EditUnitForm";
import RosterSections from "../roster/RosterSections";
import type { RosterUnit } from "../roster/unit-view";
import WarbandEncampments from "../encampments/WarbandEncampments";
import WarbandRules from "../rules/WarbandRules";
import WarbandInfo from "./WarbandInfo";
import WarbandTabs from "./WarbandTabs";
import { BackstoryTab, LogTab } from "./StoryAndLogTabs";
import TreasuryTab from "./TreasuryTab";

type WarbandSectionsProps = {
  campaignId: number;
  campaign: CampaignSummary | null;
  warband: Warband;
  sheet: ReturnType<typeof useWarbandSheet>;
  canEdit: boolean;
  breakdownOpen: boolean;
  setBreakdownOpen: (open: boolean) => void;
  onLoadout: (entry: RosterUnit) => void;
  onHire: () => void;
  onAdvance: (entry: RosterUnit) => void;
  onBuyAgain: (entry: RosterUnit, item: Item) => void;
};

/**
 * The warband page's tabs and what each holds (William, 20 Nov 2026: the tab bar sits under the
 * warband's name, and the stats, resources, plot and rules it used to sit under are the top of the
 * **Roster** tab, so Treasury, Backstory and Log open with nothing above them).
 */
export default function WarbandSections(props: WarbandSectionsProps) {
  const { campaignId, campaign, warband, sheet, canEdit } = props;
  const { capabilities } = sheet;
  const warbandId = warband.id;

  return (
    <WarbandTabs
      render={(tab, show) =>
        tab === "Roster" ? (
          <div className="flex flex-col gap-6">
            <WarbandInfo
              campaignId={campaignId}
              warband={warband}
              plot={campaign?.enable_campaign_points ? sheet.plot : undefined}
              heroes={sheet.heroes}
              hirelings={sheet.hirelings}
              henchmenGroups={sheet.henchmenGroups}
              breakdownOpen={props.breakdownOpen}
              setBreakdownOpen={props.setBreakdownOpen}
              canEdit={canEdit}
              pricing={{ table: campaign?.wyrdstone_prices, band: warband.size_band ?? 0 }}
              onTreasury={() => show("Treasury")}
            >
              <WarbandRules
                campaignId={campaignId}
                warbandId={warbandId}
                warbandName={warband.name}
                rules={sheet.rules}
                canEdit={canEdit}
              />
              <WarbandEncampments campaignId={campaignId} encampments={sheet.encampments} />
            </WarbandInfo>
            <RosterSections
              warbandId={warbandId}
              campaign={campaign}
              heroes={sheet.heroes}
              henchmenGroups={sheet.henchmenGroups}
              hirelings={sheet.hirelings}
              counts={{ hero_count: warband.hero_count, hireling_count: warband.hireling_count }}
              gold={warband.gold ?? 0}
              warbandType={warband.warband_type}
              canEdit={canEdit}
              canCreateRace={capabilities.edit_catalogue}
              onLoadout={props.onLoadout}
              onHire={props.onHire}
              onAdvance={props.onAdvance}
              onBuyAgain={props.onBuyAgain}
              renderEdit={(entry, close) => (
                <EditUnitForm
                  entry={entry}
                  campaign={campaign}
                  campaignId={campaignId}
                  warbandId={warbandId}
                  canCreateRace={capabilities.edit_catalogue}
                  onAddItem={() => props.onLoadout(entry)}
                  onClose={close}
                />
              )}
            />
          </div>
        ) : tab === "Treasury" ? (
          <TreasuryTab campaignId={campaignId} warbandId={warbandId} canEdit={canEdit} />
        ) : tab === "Backstory" ? (
          <BackstoryTab
            warband={warband}
            canEdit={capabilities.edit_backstory}
            onWarbandUpdated={sheet.mergeWarband}
          />
        ) : (
          <LogTab campaignId={campaignId} warbandId={warbandId} />
        )
      }
    />
  );
}
