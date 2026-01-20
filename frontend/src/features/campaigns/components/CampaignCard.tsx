import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import type { CampaignSummary } from "../types/campaign-types";

type CampaignCardProps = CampaignSummary;

export default function CampaignCard({
  title,
  description,
  details,
  actionLabel,
  actionVariant,
}: CampaignCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">{details}</p>
        <Button className="mt-4" variant={actionVariant}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
