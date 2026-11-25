import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ModalSheet } from "@/components/ui/modal-sheet";
import { FormError } from "@/features/campaigns/components/settings/settings-ui";
import { getRefusalMessage } from "@/lib/get-error-message";

import CodePreview, { usePreviewOf } from "./CodePreview";

type ImportCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kicker: string;
  title: string;
  /** Imports the code; a refusal is shown in the dialog in the server's words. */
  onImport: (code: string) => Promise<void>;
  /** A sentence the importer needs before going ahead (what the import costs). */
  note?: string;
};

/**
 * Import by code (the workshop): the code, what it shares (read first), then Import. A modal on
 * the web, a sheet on a phone; it stays open on a refusal, showing why.
 */
export default function ImportCodeDialog(props: ImportCodeDialogProps) {
  const { open, onOpenChange, onImport } = props;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const preview = usePreviewOf(code);

  const change = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setCode("");
      setError("");
    }
  };
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!preview.data || saving) return;
    setSaving(true);
    setError("");
    try {
      await onImport(code);
      change(false);
    } catch (refused) {
      setError(getRefusalMessage(refused, "Couldn't import it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onOpenChange={change}
      kicker={props.kicker}
      title={props.title}
      className="max-w-[480px]"
      footer={
        <div className="grid w-full grid-cols-[1fr_2fr] gap-2">
          <Button variant="secondary" className="min-h-12" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button
            className="min-h-12"
            disabled={saving || !preview.data}
            onClick={() => void submit()}
          >
            {saving ? "Importing…" : "Import"}
          </Button>
        </div>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <CodePreview id="import-code" code={code} onCode={setCode} />
        {props.note && preview.data ? <p className="m-0 text-sm text-text2">{props.note}</p> : null}
        <FormError message={error} />
      </form>
    </ModalSheet>
  );
}
