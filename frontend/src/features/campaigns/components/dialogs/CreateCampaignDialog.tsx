import type { FormEvent } from "react";
import { useState } from "react";

// components
import { Button } from "@components/button";
import { Chip } from "@components/chip";
import { Input } from "@components/input";
import { ModalSheet } from "@components/modal-sheet";
import { NumberInput } from "@components/number-input";
import { useCampaignPresets } from "../../api/preset-queries";
import { useSettingsList } from "../../api/settings-queries";
import ContentInPlay from "../settings/ContentInPlay";
import { defaultPreset, pageDepartures, presetPages } from "../settings/campaign-preset";
import { DEFAULT_PRESET } from "../settings/content-in-play";
import { PRESET_DIM } from "../settings/PresetNote";
import { Field, FormError } from "../settings/settings-ui";
import CreateCampaignPreset from "./CreateCampaignPreset";
// types
import type { CampaignCreatePayload } from "../../types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

const PAGES = [
  { key: "enable_encampments", label: "Encampments" },
  { key: "enable_locations", label: "Trade locations" },
] as const;
type Pages = Record<(typeof PAGES)[number]["key"], boolean>;
const NO_PAGES: Pages = { enable_encampments: false, enable_locations: false };

const DEFAULT_SEATS = 6;

type CreateCampaignDialogProps = {
  onCreate: (payload: CampaignCreatePayload) => Promise<void>;
  /** The trigger's classes (full width on a phone). */
  className?: string;
};

/**
 * Start a campaign (design E): which published campaign you are playing (Mordheim to begin with,
 * William 17 Nov 2026), then its name, seats, its pages and the content in play (a grade preset,
 * Up to 1c to begin with, the settings adjustable); a modal on the web, a sheet on a phone.
 *
 * The campaign picked dictates the rules: its pages show its values, greyed and still clickable,
 * and departing from one warns. The content in play is only guided by it: its settings are ticked
 * on top of the grade preset's and can be unticked again.
 */
export default function CreateCampaignDialog({ onCreate, className }: CreateCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  // the pages once the player touches them; until then the campaign preset's (null: untouched)
  const [pages, setPages] = useState<Pages | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const content = useSettingsList({ enabled: open }); // read as the dialog opens
  const campaigns = useCampaignPresets({ enabled: open });
  const [presetId, setPresetId] = useState<number | null>(null);
  // the ticked settings once the player touches them; until then the default preset's
  const [picked, setPicked] = useState<number[] | null>(null);
  const preset = content.data?.presets.find((entry) => entry.grade === DEFAULT_PRESET);
  const rows = campaigns.data ?? [];
  const playing = rows.find((row) => row.id === presetId) ?? defaultPreset(rows);
  const shownPages: Pages = pages ?? { ...NO_PAGES, ...presetPages(playing) };
  const departures = pageDepartures(playing, shownPages);
  const settingIds = [
    ...new Set([...(picked ?? preset?.setting_ids ?? []), ...(playing?.setting_ids ?? [])]),
  ];

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setName("");
      setSeats(DEFAULT_SEATS);
      setPages(null);
      setPresetId(null);
      setPicked(null);
      setError("");
    }
  };

  const submit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onCreate({
        name: name.trim(),
        max_players: seats,
        ...shownPages,
        preset_id: playing?.id ?? null,
        // the settings in play: the grade preset's unless adjusted, with the campaign's added
        ...(picked || playing?.setting_ids.length
          ? { setting_ids: settingIds }
          : { preset: DEFAULT_PRESET }),
      });
      handleOpenChange(false);
    } catch (errorResponse) {
      setError(getErrorMessage(errorResponse, "Unable to start campaign"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button className={className} onClick={() => handleOpenChange(true)}>
        Create a campaign
      </Button>
      <ModalSheet
        open={open}
        onOpenChange={handleOpenChange}
        kicker="Campaigns"
        title="Start a new campaign"
        description="Name it, pick its pages and what is in play, then share its join code with your players."
        className="max-w-[640px]"
        footer={
          <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
            <Button
              variant="secondary"
              className="min-h-12"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="min-h-12"
              disabled={isSubmitting || !name.trim()}
              onClick={() => void submit()}
            >
              {isSubmitting ? "Starting..." : "Start campaign"}
            </Button>
          </div>
        }
      >
        <form className="flex flex-col gap-5" onSubmit={(event) => void submit(event)}>
          <CreateCampaignPreset
            presets={rows}
            picked={playing}
            disabled={isSubmitting}
            onPick={(next) => {
              setPresetId(next.id);
              setPages(null); // its pages show until the player departs from them
            }}
          />
          <Field label="Campaign name" htmlFor="campaign-name">
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
              className="h-11 text-base md:h-11"
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span id="campaign-pages-label" className={CAPTION_CLASS}>
              Pages
            </span>
            <div
              role="group"
              aria-labelledby="campaign-pages-label"
              className="grid grid-cols-2 gap-2"
            >
              {PAGES.map((page) => (
                <Chip
                  key={page.key}
                  pressed={shownPages[page.key]}
                  onClick={() => setPages({ ...shownPages, [page.key]: !shownPages[page.key] })}
                  className={cn(
                    "min-h-11 px-3 text-sm font-bold",
                    page.key in presetPages(playing) && PRESET_DIM
                  )}
                >
                  {page.label}
                </Chip>
              ))}
            </div>
            {departures.map((warning) => (
              <p key={warning} className="m-0 text-[13px] text-accent-text">
                {warning}
              </p>
            ))}
          </div>
          <Field label="Seats" htmlFor="campaign-size" hint="2 to 16.">
            <NumberInput
              id="campaign-size"
              min={2}
              max={16}
              value={String(seats)}
              onChange={(event) => setSeats(Number(event.target.value))}
              containerClassName="max-w-[180px]"
              required
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className={CAPTION_CLASS}>Content in play</span>
            {content.data ? (
              <ContentInPlay
                compact
                settings={content.data.settings}
                presets={content.data.presets}
                value={settingIds}
                onChange={setPicked}
              />
            ) : (
              <p className="m-0 text-[13px] text-text2">Up to 1c.</p>
            )}
          </div>
          <FormError message={error} />
        </form>
      </ModalSheet>
    </>
  );
}

const CAPTION_CLASS = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
