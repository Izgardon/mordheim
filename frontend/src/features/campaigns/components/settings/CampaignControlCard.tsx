import { useEffect, useState } from "react";

import { Button } from "@components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@components/dialog";
import { Input } from "@components/input";
import { Label } from "@components/label";

import { updateCampaign } from "../../api/campaigns-api";

type CampaignControlCardProps = {
  campaignId: number;
  inProgress: boolean;
};

export default function CampaignControlCard({
  campaignId,
  inProgress,
}: CampaignControlCardProps) {
  const [startingGold, setStartingGold] = useState("");
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [isUnderway, setIsUnderway] = useState(inProgress);

  useEffect(() => {
    setIsUnderway(inProgress);
  }, [inProgress]);

  const handleStartCampaign = async () => {
    setIsStarting(true);
    setStartError("");

    try {
      const updated = await updateCampaign(campaignId, { in_progress: true });
      setIsUnderway(Boolean(updated.in_progress));
      setIsStartOpen(false);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setStartError(errorResponse.message || "Unable to start campaign.");
      } else {
        setStartError("Unable to start campaign.");
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Starting gold</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="number"
              min={0}
              placeholder="0"
              value={startingGold}
              onChange={(event) => setStartingGold(event.target.value)}
              className="w-40"
            />
            <Button type="button" variant="secondary">
              Confirm gold
            </Button>
          </div>
        </div>

        <div>
          <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="secondary" disabled={isUnderway || isStarting}>
                {isUnderway ? "Campaign Underway" : "Start Campaign"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start campaign</DialogTitle>
                <DialogDescription>
                  Once the campaign begins, members can begin logging progress.
                </DialogDescription>
              </DialogHeader>
              {startError ? <p className="text-sm text-red-600">{startError}</p> : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsStartOpen(false)}
                  disabled={isStarting}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleStartCampaign} disabled={isStarting}>
                  {isStarting ? "Starting..." : "Begin campaign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

