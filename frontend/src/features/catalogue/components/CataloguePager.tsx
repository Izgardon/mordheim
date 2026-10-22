import { Button } from "@/components/ui/button";

type CataloguePagerProps = {
  page: number;
  totalPages: number;
  previous: () => void;
  next: () => void;
};

/** Previous, "2 / 5" and Next under a card list; nothing when it fits on one page. */
export default function CataloguePager({ page, totalPages, previous, next }: CataloguePagerProps) {
  if (totalPages <= 1) {
    return null;
  }
  return (
    <div className="flex items-center justify-center gap-4 pt-1">
      <Button size="sm" variant="secondary" disabled={page === 0} onClick={previous}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <Button size="sm" variant="secondary" disabled={page >= totalPages - 1} onClick={next}>
        Next
      </Button>
    </div>
  );
}
