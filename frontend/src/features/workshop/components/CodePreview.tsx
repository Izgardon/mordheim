import { Input } from "@/components/ui/input";
import { Field } from "@/features/campaigns/components/settings/settings-ui";
import { getRefusalMessage } from "@/lib/get-error-message";

import { CODE_LENGTH, cleanCode, useSharedPreview } from "../api/workshop-queries";
import type { SharedPreview } from "../types/workshop-types";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What a code shares, as its preview reads: a warband's type, cost and roster, or a list's types. */
export function PreviewSummary({ preview }: { preview: SharedPreview }) {
  const kind = preview.kind === "warband" ? "Warband" : "Warband list";
  const types =
    preview.kind === "warband"
      ? (preview.warband_type?.name ?? "")
      : preview.warband_types.map((type) => type.name).join(", ");
  return (
    <div className="flex flex-col gap-1 border border-line bg-page p-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">
        {[kind, preview.maker ? `by ${preview.maker}` : ""].filter(Boolean).join(" · ")}
      </span>
      <span className="font-display text-lg font-semibold text-head">{preview.name}</span>
      {types ? <span className="text-sm text-text2">{types}</span> : null}
      {preview.kind === "warband" ? (
        <>
          <CostLine cost={preview.cost} />
          <span className="text-sm text-text2">
            {[
              plural(preview.heroes, "hero", "heroes"),
              plural(preview.henchmen, "henchman", "henchmen"),
              plural(preview.hired_swords, "hired sword", "hired swords"),
            ].join(" · ")}
          </span>
        </>
      ) : null}
    </div>
  );
}

/** The code typed, as the server will read it, and the preview once it is whole. */
export function usePreviewOf(code: string) {
  const preview = useSharedPreview(code);
  const whole = cleanCode(code).length === CODE_LENGTH;
  return {
    data: whole ? preview.data : undefined,
    error: whole && preview.error ? getRefusalMessage(preview.error) : "",
    isLoading: whole && preview.isLoading,
  };
}

/** A share code's field, then what it shares (or the server's word that nothing has it). */
export default function CodePreview({
  id,
  code,
  onCode,
  label = "Code",
}: {
  id: string;
  code: string;
  onCode: (code: string) => void;
  label?: string;
}) {
  const preview = usePreviewOf(code);
  return (
    <div className="flex flex-col gap-3">
      <Field label={label} htmlFor={id}>
        <Input
          id={id}
          value={code}
          onChange={(event) => onCode(event.target.value)}
          maxLength={CODE_LENGTH + 4}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-12 font-mono text-lg font-bold uppercase tracking-[0.2em] md:h-12"
        />
      </Field>
      {preview.isLoading ? <p className="m-0 text-sm text-text2">Reading the code…</p> : null}
      {preview.error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {preview.error}
        </p>
      ) : null}
      {preview.data ? <PreviewSummary preview={preview.data} /> : null}
    </div>
  );
}

/** "Cost 455 gc": a workshop warband's running cost (it has no budget). */
function CostLine({ cost }: { cost: number }) {
  return (
    <p className="m-0 text-sm text-text2">
      Cost <span className="font-bold text-head">{cost} gc</span>
    </p>
  );
}
