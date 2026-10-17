import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@components/button";

import type { UnitKindKey } from "../../../types/units";
import type { UnitKindConfig } from "../../../units/unit-kind-types";

type AddUnitFormProps<K extends UnitKindKey> = {
  kind: UnitKindConfig<K>;
  onCreate: () => Promise<void> | void;
  onCancel: () => void;
  error: string;
  /** Limit notices under the form ("Maximum of 6 heroes reached."). */
  notice?: ReactNode;
  /** The kind's fields (AddFields slot). */
  children: ReactNode;
};

/** The "Add <unit>" form shell: the kind's fields, Cancel and "Create <unit>", errors, limits. */
export default function AddUnitForm<K extends UnitKindKey>({
  kind,
  onCreate,
  onCancel,
  error,
  notice,
  children,
}: AddUnitFormProps<K>) {
  const [isCreating, setIsCreating] = useState(false);
  const { actionsClassName, actionsInnerClassName } = kind.addForm;

  const handleCreateClick = async () => {
    setIsCreating(true);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  };

  const buttons = (
    <>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" onClick={handleCreateClick} disabled={isCreating}>
        {isCreating ? (
          <>
            <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
            Creating...
          </>
        ) : (
          kind.labels.create
        )}
      </Button>
    </>
  );

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-[rgba(12,9,6,0.92)] p-4 text-foreground shadow-[0_18px_40px_rgba(5,20,24,0.45)]">
      {children}
      <div className={actionsClassName}>
        {actionsInnerClassName ? <div className={actionsInnerClassName}>{buttons}</div> : buttons}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {notice}
    </div>
  );
}
