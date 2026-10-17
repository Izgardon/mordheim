import { CardBackground } from "@components/card-background";
import { WarbandPageSkeleton } from "./WarbandPageSkeleton";
import CreateWarbandDialog from "../shared/dialogs/CreateWarbandDialog";

import type { WarbandCreatePayload } from "../../types/warband-types";

type WarbandPageStatusProps = {
  isLoading: boolean;
  error: string;
  isMobile: boolean;
  isViewingOtherWarband: boolean;
  campaignId: number;
  onCreate: (payload: WarbandCreatePayload) => Promise<void>;
};

/** The page before a warband is on screen: loading, a load error, or "create one". */
export default function WarbandPageStatus({
  isLoading,
  error,
  isMobile,
  isViewingOtherWarband,
  campaignId,
  onCreate,
}: WarbandPageStatusProps) {
  return (
    <div className="min-h-0 space-y-6">
      {isLoading ? (
        <WarbandPageSkeleton variant={isMobile ? "mobile" : "default"} />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <CardBackground className="mt-20 p-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isViewingOtherWarband
                ? "No warband found for this record."
                : "No warband created for this campaign yet."}
            </p>
            {!isViewingOtherWarband ? (
              <CreateWarbandDialog campaignId={campaignId} onCreate={onCreate} />
            ) : null}
          </div>
        </CardBackground>
      )}
    </div>
  );
}
