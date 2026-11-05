import type { EditorSaveState } from "../api/editor-queries";
import type { EditorAnswer } from "../types/editor-types";

/** What every editor section gets: the editor's read, its campaign and the one save. */
export type SectionProps = {
  answer: EditorAnswer;
  campaignId: number;
  save: EditorSaveState;
};
