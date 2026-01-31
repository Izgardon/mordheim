import type { CampaignLayoutContext } from "../../routes/CampaignLayout";

type SettingsHeaderProps = {
  campaign: CampaignLayoutContext["campaign"];
};

export default function SettingsHeader({ campaign }: SettingsHeaderProps) {
  if (!campaign) {
    return null;
  }

  return (
    <header className="text-left">
      <h1 className=" text-lg md:text-2xl">{campaign.name}</h1>
      <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-4 py-2 text-sm text-muted-foreground shadow-[0_12px_22px_rgba(5,20,24,0.25)]">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Rally code
        </span>
        <span className="font-mono text-foreground">{campaign.join_code}</span>
      </div>
    </header>
  );
}
