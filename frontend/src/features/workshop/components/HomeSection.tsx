import type { ReactNode } from "react";
import type { IconType } from "react-icons";

import { SectionHead } from "@/components/ui/section-title";
import { CAMPAIGN_GRID } from "@/features/campaigns/components/campaigns/CampaignsSkeleton";
import { getErrorMessage } from "@/lib/get-error-message";

/** A section's buttons on a phone: tall, two to a row. */
export const SECTION_BUTTON = "max-[960px]:min-h-12";

/** Loading and failure of my workshop, as each section shows them. */
export const workshopState = (query: { isPending: boolean; error: unknown }) => ({
  isLoading: query.isPending,
  error: query.error ? getErrorMessage(query.error, "Unable to load your workshop") : "",
});

/** A section's title with its icon before it. */
export function IconTitle({ icon: Icon, title }: { icon?: IconType; title: string }) {
  if (!Icon) return title;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {title}
    </span>
  );
}

/**
 * A workshop section (a part of Home's Workshop, at level 3, or the workshop's own page): its
 * title and buttons, then its cards.
 */
export default function HomeSection(props: {
  id: string;
  title: string;
  icon?: IconType;
  level?: 2 | 3;
  actions: ReactNode;
  state: { isLoading: boolean; error: string };
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={props.id} className="flex flex-col gap-4">
      <SectionHead
        id={props.id}
        title={<IconTitle icon={props.icon} title={props.title} />}
        level={props.level}
        className="flex-wrap items-center"
        aside={
          <div className="flex gap-2 max-[960px]:grid max-[960px]:w-full max-[960px]:grid-cols-2">
            {props.actions}
          </div>
        }
      />
      {props.state.isLoading ? (
        <p className="m-0 text-sm text-text2">Loading…</p>
      ) : props.state.error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {props.state.error}
        </p>
      ) : props.count === 0 ? (
        <p className="m-0 text-sm text-text2">{props.empty}</p>
      ) : (
        <div className={CAMPAIGN_GRID}>{props.children}</div>
      )}
    </section>
  );
}
