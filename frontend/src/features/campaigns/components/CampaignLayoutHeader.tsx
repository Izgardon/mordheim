import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";

type CampaignLayoutHeaderProps = {
  onSignOut: () => void;
};

export default function CampaignLayoutHeader({ onSignOut }: CampaignLayoutHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
        <Link to="/campaigns">Back to the chronicle</Link>
      </Button>
      <Button variant="ghost" className="text-red-600 hover:text-red-700" onClick={onSignOut}>
        Log out
      </Button>
    </header>
  );
}
