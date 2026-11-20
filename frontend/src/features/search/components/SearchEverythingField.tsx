import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Search everything as a field, in the rail and the phone's Reference sheet (William, 20 Nov 2026:
 * "should just be an input with a search button that navigates you to that page rather than the
 * initial link"): searching opens the page with what was typed already applied (`?q=`, the
 * parameter the page reads), and an empty field opens it as the link did.
 */
export default function SearchEverythingField({
  campaignId,
  onNavigate,
  className,
}: {
  campaignId: number;
  /** After the move: the sheet that held the field closes. */
  onNavigate?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  return (
    <form
      role="search"
      className={cn(
        "flex min-h-9 items-stretch border border-strong bg-page focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring",
        className
      )}
      onSubmit={(event) => {
        event.preventDefault();
        const query = typed.trim();
        navigate(
          `/campaigns/${campaignId}/search${query ? `?q=${encodeURIComponent(query)}` : ""}`
        );
        onNavigate?.();
      }}
    >
      <input
        type="search"
        aria-label="Search everything"
        placeholder="Search"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="min-w-0 flex-1 bg-transparent px-2.5 text-sm text-ink outline-none placeholder:text-faint"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex w-9 shrink-0 items-center justify-center border-l border-line text-muted-foreground hover:text-ink"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}
