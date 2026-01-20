import { Button } from "../../../components/ui/button";
import { useAuth } from "../../auth/hooks/use-auth";
import CampaignCard from "../components/CampaignCard";
import type { CampaignSummary } from "../types/campaign-types";

const campaigns: CampaignSummary[] = [
  {
    title: "Season of Ashes",
    description: "4 warbands · 12 games logged",
    details: "Track your post-battle sequence, manage rosters, and keep the narrative intact.",
    actionLabel: "Enter campaign",
  },
  {
    title: "New campaign",
    description: "Start a fresh storyline",
    details: "Create a new roster sheet and invite your friends once you are ready.",
    actionLabel: "Create campaign",
    actionVariant: "outline",
  },
];

export default function Campaigns() {
  const { user, isReady, signOut } = useAuth();

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
              Campaigns
            </p>
            <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">
              {isReady && user
                ? `Welcome, ${user.name || user.email}`
                : "Loading your campaign room..."}
            </h1>
            <p className="text-slate-600">
              Choose a campaign or spin up a new story arc when you are ready.
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Log out
          </Button>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.title} {...campaign} />
          ))}
        </section>
      </div>
    </main>
  );
}
