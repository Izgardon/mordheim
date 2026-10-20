import type { CatalogueDeleteConfirmState } from "@/lib/catalogue-delete";

/**
 * What a `use<Kind>Form` hook gives the inline and dialog shells: the save (it runs `after`
 * straight after its success, in the same update), whether it is running and the line under the
 * form; a kind that can be edited adds the delete and its confirm.
 */
export type CatalogueFormState = {
  isSaving: boolean;
  formError: string;
  save: (after?: () => void) => Promise<void>;
  deleteConfirm?: CatalogueDeleteConfirmState;
  remove?: (after?: () => void) => Promise<void>;
};
