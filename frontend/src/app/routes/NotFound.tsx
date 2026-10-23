import { Link } from "react-router-dom";

/** Any URL no route matches (FE-UX-03); the way back goes to sign-in, or on to the campaigns. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          404
        </p>
        <h1 className="theme-heading-soft text-lg font-bold md:text-2xl">LOST IN THE RUINS</h1>
        <p className="mt-2 text-muted-foreground">
          The streets shift. Head back to the chronicle and try again.
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-muted-foreground underline">
          Back to the chronicle
        </Link>
      </div>
    </main>
  );
}
