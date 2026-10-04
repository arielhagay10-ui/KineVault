export function RouteLoading({ title }: { title: string }) {
  return <div className="mx-auto w-full max-w-7xl px-6 py-10" role="status" aria-live="polite" aria-busy="true">
    <p className="text-sm font-medium text-muted-foreground">{title}</p>
    <div aria-hidden="true" className="mt-6 space-y-4">
      <div className="h-10 w-2/3 max-w-md rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map(item => <div key={item} className="h-52 rounded-2xl border border-border bg-card" />)}
      </div>
    </div>
  </div>;
}
