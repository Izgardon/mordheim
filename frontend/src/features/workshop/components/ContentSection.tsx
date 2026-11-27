import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SectionHead } from "@/components/ui/section-title";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useOpenWorkshop, useWorkshop } from "../api/workshop-queries";
import { CONTENT_KINDS, workshopPath } from "../paths";
import { CHIP_LINK } from "./WorkshopNav";

const CHIP = cn(CHIP_LINK, "border-border text-text2 hover:bg-raised hover:text-ink");

/**
 * Home's My content (a part of its Workshop): my workshop's own catalogue entries, a link per kind to its page there.
 * Before my workshop's first use a link makes it first (the server's `POST workshop/`).
 */
export default function ContentSection() {
  const navigate = useNavigate();
  const workshop = useWorkshop();
  const opening = useOpenWorkshop();
  const id = workshop.data?.id ?? null;
  const open = (path: string) =>
    opening.mutate(undefined, {
      onSuccess: (made) => (made.id ? navigate(workshopPath(made.id, path)) : undefined),
      onError: (error) => toast.error(getErrorMessage(error)),
    });

  return (
    <section aria-labelledby="your-content" className="flex flex-col gap-4">
      <SectionHead id="your-content" title="My content" level={3} />
      <div className="flex flex-wrap gap-1.5">
        {CONTENT_KINDS.map((kind) =>
          id ? (
            <Link key={kind.path} to={workshopPath(id, kind.path)} className={CHIP}>
              {kind.label}
            </Link>
          ) : (
            <button
              key={kind.path}
              type="button"
              className={CHIP}
              disabled={workshop.isPending || opening.isPending}
              onClick={() => open(kind.path)}
            >
              {kind.label}
            </button>
          )
        )}
      </div>
    </section>
  );
}
