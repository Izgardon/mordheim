// components
import { Card } from "@components/card";

type PlaceholderPageProps = {
  title: string;
};

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground">
        No record yet. The {title.toLowerCase()} page is still being etched.
      </p>
    </Card>
  );
}





