import { Button } from "@components/button";
import { Tooltip } from "@components/tooltip";
import { Pencil } from "lucide-react";

/** A catalogue row's Edit: the pencil that opens the page's form on that entry. */
export function EditRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip
      trigger={
        <Button
          type="button"
          aria-label={label}
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      }
      content="Edit"
    />
  );
}
