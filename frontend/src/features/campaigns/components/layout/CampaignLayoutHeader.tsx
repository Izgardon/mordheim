// components
import { Button } from "@components/button";

type CampaignLayoutHeaderProps = {
  onOpenNav?: () => void;
};

export default function CampaignLayoutHeader({ onOpenNav }: CampaignLayoutHeaderProps) {
  if (!onOpenNav) {
    return null;
  }

  return (
    <header className="flex items-center justify-between">
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-foreground lg:hidden"
        onClick={onOpenNav}
      >
        Menu
      </Button>
    </header>
  );
}





