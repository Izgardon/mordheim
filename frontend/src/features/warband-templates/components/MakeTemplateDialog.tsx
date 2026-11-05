import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { SearchSelect, type SearchOption } from "@/components/ui/search-select";
import { outOfPlay, useSettingsById } from "@/features/campaigns/api/settings-queries";

import { useMakeTemplate } from "../api/editor-queries";
import { useWarbandTemplates } from "../api/template-queries";
import type { WarbandTemplateSummary } from "../types/template-types";

type MakeTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  /** The warband type it is made for (it serves none yet when absent: Basics adds them). */
  forType?: { id: number; name: string };
  /** The new template's id: the editor opens on it. */
  onMade: (templateId: number) => void;
};

const sourceOption = (
  template: WarbandTemplateSummary,
  settings: ReturnType<typeof useSettingsById>
): SearchOption => ({
  id: template.id,
  title: template.name,
  subtitle: [
    template.campaign_id === null ? "The book's" : template.replaces ? "House version" : "Custom",
    template.types.map((type) => type.name).join(", "),
  ]
    .filter(Boolean)
    .join(" · "),
  warning: outOfPlay(template, settings),
});

/**
 * Make a template (the templates plan, phase 4): start blank, or copy any template the campaign
 * can see (the book's, a house version or one of its own) and edit the copy. It serves the type
 * it is made for, never the copied one's.
 */
export default function MakeTemplateDialog({
  open,
  onOpenChange,
  campaignId,
  forType,
  onMade,
}: MakeTemplateDialogProps) {
  const [name, setName] = useState(forType?.name ?? "");
  const nameId = useId();
  const [copying, setCopying] = useState(false);
  const [source, setSource] = useState<SearchOption | null>(null);
  const templates = useWarbandTemplates(campaignId);
  const settings = useSettingsById();
  const { make, pending, error } = useMakeTemplate(campaignId);
  const ready = name.trim() && (!copying || source);

  const submit = async () => {
    const answer = await make({
      name: name.trim(),
      copy_of: copying && source ? Number(source.id) : null,
      type_ids: forType ? [forType.id] : [],
    });
    if (answer) {
      onOpenChange(false);
      onMade(answer.template.id);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={onOpenChange}
      kicker={forType ? forType.name : "Warband template"}
      title="Make a template"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!ready || pending} onClick={() => void submit()}>
            {pending ? "Making..." : "Make the template"}
          </Button>
        </>
      }
    >
      <label htmlFor={nameId} className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">Name</span>
        <Input
          id={nameId}
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div role="group" aria-label="Start" className="flex flex-wrap gap-1.5">
        <Chip pressed={!copying} onClick={() => setCopying(false)}>
          Start blank
        </Chip>
        <Chip pressed={copying} onClick={() => setCopying(true)}>
          Copy a template
        </Chip>
      </div>
      {copying ? (
        <SearchSelect
          label="Copy of"
          placeholder="Search templates"
          value={source}
          options={templates.data.map((template) => sourceOption(template, settings))}
          loading={templates.isLoading}
          emptyText="No template by that name."
          onChange={setSource}
        />
      ) : null}
      {error ? <p className="m-0 text-sm font-semibold text-danger">{error}</p> : null}
    </ModalSheet>
  );
}
