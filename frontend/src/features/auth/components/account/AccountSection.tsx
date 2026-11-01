import type { ReactNode } from "react";

// components
import { Card } from "@components/card";
import { SectionTitle } from "@components/section-title";
import { cn } from "@/lib/utils";

type AccountSectionProps = {
  title: string;
  description: string;
  /** Deleting the account reads in danger colours. */
  tone?: "danger";
  children: ReactNode;
};

/** One section of the account page, in the settings cards' frame (design E). */
export function AccountSection({ title, description, tone, children }: AccountSectionProps) {
  return (
    <Card
      as="section"
      aria-label={title}
      className={cn(
        "flex flex-col items-start gap-4 p-5 max-[960px]:p-4",
        tone === "danger" && "border-danger-line"
      )}
    >
      <div className="flex flex-col gap-1">
        <SectionTitle className={tone === "danger" ? "text-danger" : undefined}>
          {title}
        </SectionTitle>
        <p className="m-0 text-sm text-text2">{description}</p>
      </div>
      {children}
    </Card>
  );
}

/** An account form: its fields at a readable width, then its button. */
export const ACCOUNT_FORM = "flex w-full max-w-[420px] flex-col items-start gap-4";
