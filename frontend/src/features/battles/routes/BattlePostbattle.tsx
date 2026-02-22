import { useParams } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { CardBackground } from "@/components/ui/card-background";

export default function BattlePostbattle() {
  const { battleId } = useParams();

  return (
    <div className="min-h-0 space-y-4">
      <PageHeader title="Postbattle" subtitle={`Session #${battleId ?? "-"}`} />
      <CardBackground className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          Postbattle page is next. Winner declaration and confirmations will land here.
        </p>
      </CardBackground>
    </div>
  );
}

