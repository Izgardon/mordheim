import type { FormEvent } from "react";
import { useState } from "react";

// components
import { Button } from "@components/button";
import { Chip } from "@components/chip";
import { Input } from "@components/input";
import { ModalSheet } from "@components/modal-sheet";
import { NumberInput } from "@components/number-input";
import { useSettingsList } from "../../api/settings-queries";
import ContentInPlay from "../settings/ContentInPlay";
import { DEFAULT_PRESET } from "../settings/content-in-play";
import { Field, FormError } from "../settings/settings-ui";
// types
import type { CampaignCreatePayload } from "../../types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

const PAGES = [
  { key: "enable_encampments", label: "Encampments", hint: "Camps the players own." },
  { key: "enable_locations", label: "Locations", hint: "Places heroes visit and roll on." },
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
 * Start a campaign (design E): its name, seats, its pages and the content in play (a grade preset,
 * Up to 1c to begin with, the settings adjustable); a modal on the web, a sheet on a phone.
 */
export default function CreateCampaignDialog({ onCreate, className }: CreateCampaignDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [pages, setPages] = useState<Pages>(NO_PAGES);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const content = useSettingsList({ enabled: open }); // read as the dialog opens
  // the ticked settings once the player touches them; until then the default preset's
  const [picked, setPicked] = useState<number[] | null>(null);
  const preset = content.data?.presets.find((entry) => entry.grade === DEFAULT_PRESET);
  const settingIds = picked ?? preset?.setting_ids ?? [];

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setName("");
      setSeats(DEFAULT_SEATS);
      setPages(NO_PAGES);
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
        ...pages,
        ...(picked ? { setting_ids: picked } : { preset: DEFAULT_PRESET }),
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
          <Field label="Campaign name" htmlFor="campaign-name">
            <Input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Shards of the Comet"
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
                  pressed={pages[page.key]}
                  onClick={() =>
                    setPages((current) => ({ ...current, [page.key]: !current[page.key] }))
                  }
                  className="flex min-h-[60px] flex-col items-start justify-center gap-0.5 px-3 py-2 text-left"
                >
                  <span className="text-sm font-bold">{page.label}</span>
                  <span className="text-xs font-medium text-text2">{page.hint}</span>
                </Chip>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              Either can be switched on later in Settings.
            </span>
          </div>
          <Field label="Seats" htmlFor="campaign-size" hint="Players who can join, 2 to 16.">
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
              <p className="m-0 text-[13px] text-text2">
                Up to 1c to begin with: every setting at or below it. You can change it in Settings.
              </p>
            )}
          </div>
          <FormError message={error} />
        </form>
      </ModalSheet>
    </>
  );
}

const CAPTION_CLASS = "text-[11px] font-bold uppercase tracking-[0.12em] text-faint";
