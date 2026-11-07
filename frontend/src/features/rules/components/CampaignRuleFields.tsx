import { useId } from "react";

import { Input } from "@components/input";

import type { CampaignRulePayload } from "../types/rule-types";

const LABEL = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
const TEXTAREA =
  "min-h-[140px] w-full border border-strong bg-page px-3 py-2 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/** A campaign rule's title and body, as the add form and the edit dialog show them. */
export default function CampaignRuleFields({
  value,
  onChange,
}: {
  value: CampaignRulePayload;
  onChange: (value: CampaignRulePayload) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-title`} className={LABEL}>
          Title
        </label>
        <Input
          id={`${id}-title`}
          maxLength={160}
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-body`} className={LABEL}>
          Rule
        </label>
        <textarea
          id={`${id}-body`}
          className={TEXTAREA}
          maxLength={8000}
          value={value.body}
          onChange={(event) => onChange({ ...value, body: event.target.value })}
        />
      </div>
    </div>
  );
}
