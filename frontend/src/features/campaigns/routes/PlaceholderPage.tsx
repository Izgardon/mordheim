// components
import { Card } from "@components/card";
import { PageHeader } from "@components/page-header";

type PlaceholderPageProps = {
  title: string;
};

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="min-h-0 space-y-6">
      <PageHeader title={title} subtitle="Coming soon" />
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          No record yet. The {title.toLowerCase()} page is still being etched.
        </p>
      </Card>
    </div>
  );
}





