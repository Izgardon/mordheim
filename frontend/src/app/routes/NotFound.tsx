export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">Lost in the ruins</h1>
        <p className="mt-2 text-muted-foreground">
          The streets shift. Head back to the chronicle and try again.
        </p>
      </div>
    </main>
  );
}
