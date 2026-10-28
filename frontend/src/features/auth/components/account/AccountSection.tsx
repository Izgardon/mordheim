import type { ReactNode } from "react";

// components
import { CardBackground } from "@components/card-background";

type AccountSectionProps = {
  title: string;
  description: string;
  children: ReactNode;
};

/** One section of the account page, in the settings cards' frame. */
export function AccountSection({ title, description, children }: AccountSectionProps) {
  return (
    <section aria-label={title}>
      <CardBackground className="space-y-3 bg-[rgba(12,9,6,0.92)] p-3 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </CardBackground>
    </section>
  );
}
