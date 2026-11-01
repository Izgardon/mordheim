import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

/**
 * Any URL no route matches (FE-UX-03; design E): a card on the page colour, with the way back to
 * sign-in, which goes on to the campaigns for someone signed in.
 */
export default function NotFound() {
  return (
    <main className="flex h-[100dvh] items-center justify-center overflow-y-auto bg-page px-4">
      <div className="flex w-full max-w-[480px] flex-col items-start gap-4 border border-border bg-surface p-8 max-[960px]:p-6">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-accent-text">
          404 · Page not found
        </span>
        <h1 className="m-0 font-display text-[34px] font-semibold leading-tight text-head">
          Lost in the ruins
        </h1>
        <Button asChild className="min-h-12">
          <Link to="/">Back to the chronicle</Link>
        </Button>
      </div>
    </main>
  );
}
