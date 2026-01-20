export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          404
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-slate-600">Head back to the war room and try again.</p>
      </div>
    </main>
  );
}
