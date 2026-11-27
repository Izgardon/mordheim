import type { CampaignPresetState } from "../../types/campaign-types";
import SettingsDisclosure from "./SettingsDisclosure";
import { andList } from "./settings-summaries";

/** "Exploration chart, Trade locations, Encampments and 5 more". */
function namesLine(labels: string[]) {
  return labels.length > 4
    ? `${labels.slice(0, 3).join(", ")} and ${labels.length - 3} more`
    : andList(labels);
}

/**
 * What the campaign's preset sets, folded: the rules it sets by name, then each with its value
 * and, where the campaign departs from it, the server's warning. The warnings show while it is
 * folded too, because a departure has to be read.
 */
export default function PresetSets({ state }: { state: CampaignPresetState }) {
  if (!state.sets.length) {
    return <p className="m-0 text-sm text-text2">{`${state.preset_name} sets nothing.`}</p>;
  }
  const departures = new Map(state.departures.map((entry) => [entry.field, entry.message]));
  return (
    <SettingsDisclosure
      title="What it sets"
      summary={namesLine(state.sets.map((entry) => entry.label))}
      warnings={[...departures.values()]}
    >
      <dl className="m-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
        {state.sets.map((entry) => (
          <div key={entry.field} className="contents">
            <dt className="text-text2">{entry.label}</dt>
            <dd className="m-0 flex flex-col gap-0.5">
              <span className="font-bold text-head">{entry.text}</span>
              {departures.has(entry.field) ? (
                <span className="text-[13px] text-accent-text">{departures.get(entry.field)}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </SettingsDisclosure>
  );
}
