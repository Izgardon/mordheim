import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { CardBackground } from "@/components/ui/card-background";
import { getBattleState } from "@/features/battles/api/battles-api";
import type { BattleState } from "@/features/battles/types/battle-types";
import { createBattleSessionSocket } from "@/lib/realtime";

export default function BattleActive() {
  const { id, battleId } = useParams();
  const campaignId = Number(id);
  const numericBattleId = Number(battleId);

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshBattleState = useCallback(async () => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) {
      return;
    }
    const state = await getBattleState(campaignId, numericBattleId, 0);
    setBattleState(state);
  }, [campaignId, numericBattleId]);

  useEffect(() => {
    if (Number.isNaN(campaignId) || Number.isNaN(numericBattleId)) {
      setError("Invalid battle route.");
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError("");

    getBattleState(campaignId, numericBattleId, 0)
      .then((state) => {
        if (active) {
          setBattleState(state);
        }
      })
      .catch((errorResponse) => {
        if (!active) {
          return;
        }
        if (errorResponse instanceof Error) {
          setError(errorResponse.message || "Unable to load battle");
        } else {
          setError("Unable to load battle");
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [campaignId, numericBattleId]);

  useEffect(() => {
    if (Number.isNaN(numericBattleId)) {
      return;
    }
    const socket = createBattleSessionSocket(numericBattleId, () => {
      void refreshBattleState();
    });
    return () => {
      socket.close();
    };
  }, [numericBattleId, refreshBattleState]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading battle...</p>;
  }

  if (error || !battleState) {
    return <p className="text-sm text-red-600">{error || "Unable to load battle."}</p>;
  }

  if (battleState.battle.status === "canceled" || battleState.battle.status === "ended") {
    return <Navigate to={`/campaigns/${campaignId}`} replace />;
  }

  return (
    <div className="min-h-0 space-y-4">
      <PageHeader
        title="Battle"
        subtitle={`Session #${battleId ?? "-"}${battleState.battle.title ? ` • ${battleState.battle.title}` : ""}`}
      />
      <CardBackground className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Active battle page is next. Prebattle flow is now implemented first.
        </p>
      </CardBackground>
    </div>
  );
}
