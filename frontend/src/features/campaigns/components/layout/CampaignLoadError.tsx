import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

type CampaignLoadErrorProps = {
  message: string;
  /** Reads the campaign again; omitted when retrying can't help (an invalid id). */
  onRetry?: () => void;
};

/** A campaign that couldn't be read: why, Retry, and the way back to the list (BUG-144). */
export default function CampaignLoadError({ message, onRetry }: CampaignLoadErrorProps) {
  return (
    <main className="campaigns max-h-full bg-transparent">
      <div className="mx-auto flex max-h-full max-w-6xl items-center justify-center px-6 py-10">
        <ErrorState
          title="Couldn't open this campaign"
          message={message}
          onRetry={onRetry}
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link to="/campaigns">Back to campaigns</Link>
            </Button>
          }
        />
      </div>
    </main>
  );
}
