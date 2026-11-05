import { useState } from "react";

import { Chip } from "@/components/ui/chip";
import { SidePanel } from "@/components/ui/side-panel";
import { useCampaignCapabilities } from "@/features/campaigns/capabilities";
import { useMediaQuery } from "@/lib/use-media-query";

import { useEditorSave, useTemplateEditor } from "../api/editor-queries";
import type { EditorAnswer, EditorSection } from "../types/editor-types";
import BasicsSection from "./BasicsSection";
import EditorActions from "./EditorActions";
import { changeNote, factsLine, SECTIONS, warningsFor } from "./editor-facts";
import FightersSection from "./FightersSection";
import ListsSection from "./ListsSection";
import RulesSection from "./RulesSection";
import UpgradesSection from "./UpgradesSection";
import type { SectionProps } from "./section-props";

type TemplateEditorProps = {
  campaignId: number;
  /** The template being edited; null: closed. */
  templateId: number | null;
  /** The editor now shows another template: a book template's house version, or the book again. */
  onTemplateChange: (templateId: number) => void;
  onClose: () => void;
};

const SECTION_VIEWS: Record<EditorSection, (props: SectionProps) => JSX.Element> = {
  basics: BasicsSection,
  fighters: FightersSection,
  lists: ListsSection,
  rules: RulesSection,
  upgrades: UpgradesSection,
};

/** The section chips, each with its warnings' count. */
function SectionChips({
  answer,
  section,
  onPick,
}: {
  answer: EditorAnswer;
  section: EditorSection;
  onPick: (section: EditorSection) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Section"
      className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5"
    >
      {SECTIONS.map(({ id, label }) => {
        const warned = warningsFor(answer.warnings, id).length;
        return (
          <Chip key={id} pressed={section === id} className="shrink-0" onClick={() => onPick(id)}>
            {label}
            {warned ? <span className="font-mono text-xs text-danger">{warned}</span> : null}
          </Chip>
        );
      })}
    </div>
  );
}

function EditorBody({
  answer,
  campaignId,
  onTemplateChange,
  onClose,
}: Omit<TemplateEditorProps, "templateId"> & { answer: EditorAnswer }) {
  const [section, setSection] = useState<EditorSection>("basics");
  const capabilities = useCampaignCapabilities(campaignId);
  const save = useEditorSave(campaignId, answer.template.id, onTemplateChange);
  const View = SECTION_VIEWS[section];
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-[13px] text-text2">{factsLine(answer)}</p>
          <EditorActions
            answer={answer}
            campaignId={campaignId}
            canDelete={capabilities.delete_catalogue}
            onReverted={onTemplateChange}
            onDeleted={onClose}
          />
        </div>
        <p className="m-0 text-xs text-muted-foreground">{changeNote(answer)}</p>
      </div>
      <SectionChips answer={answer} section={section} onPick={setSection} />
      <View
        key={`${section}-${answer.template.id}`}
        answer={answer}
        campaignId={campaignId}
        save={save}
      />
    </>
  );
}

/**
 * The template editor (the templates plan, phase 4): a drawer on the web and a bottom sheet on a
 * phone. Its header names the template with where it comes from, what it was copied from and how
 * many warbands use it, and the change note; then Basics, Fighters, Lists, Rules and Upgrades,
 * each saved on its own. The first save of a book template makes the campaign's house version,
 * whose id the editor follows.
 */
export default function TemplateEditor(props: TemplateEditorProps) {
  const { campaignId, templateId } = props;
  // the last template shown stays while the panel closes, so it doesn't blink to "Loading"
  const [shownId, setShownId] = useState(templateId);
  if (templateId !== null && templateId !== shownId) setShownId(templateId);
  const query = useTemplateEditor(campaignId, shownId);
  const isMobile = useMediaQuery("(max-width: 960px)");
  const answer = query.data;
  return (
    <SidePanel
      open={templateId !== null}
      onOpenChange={(open) => (open ? null : props.onClose())}
      kicker="Warband template"
      // on a phone the sheet keeps one height, so it doesn't jump as the sections change
      className={isMobile ? "h-[85dvh]" : undefined}
      title={answer?.template.name ?? "Warband template"}
    >
      {answer ? (
        <EditorBody
          answer={answer}
          campaignId={campaignId}
          onTemplateChange={props.onTemplateChange}
          onClose={props.onClose}
        />
      ) : (
        <p className="m-0 text-sm text-text2">
          {query.isError ? "Unable to load this template." : "Loading…"}
        </p>
      )}
    </SidePanel>
  );
}
