export default function RequestsLoading() {
  return (
    <div className="flex flex-col gap-8 p-8 w-full animate-pulse">
      {/* Header skeleton */}
      <header className="flex justify-between items-end">
        <div className="space-y-3">
          <div className="h-10 w-64 bg-white/10 dark:bg-white/5 rounded-xl" />
          <div className="h-4 w-96 bg-white/10 dark:bg-white/5 rounded-lg" />
        </div>
        <div className="h-10 w-36 bg-white/10 dark:bg-white/5 rounded-xl" />
      </header>

      {/* Analytics cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card p-8 space-y-4">
            <div className="h-3 w-24 bg-white/10 dark:bg-white/5 rounded" />
            <div className="h-8 w-40 bg-white/10 dark:bg-white/5 rounded-lg" />
            <div className="h-3 w-20 bg-white/10 dark:bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-4 items-center">
        <div className="h-11 flex-1 max-w-xl bg-white/10 dark:bg-white/5 rounded-xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-11 w-20 bg-white/10 dark:bg-white/5 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="glass-card overflow-hidden">
        <div className="h-14 bg-white/5 dark:bg-white/[0.02] border-b border-white/10" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-6 px-6 py-5 border-b border-border/50">
            <div className="w-4 h-4 rounded bg-white/10 dark:bg-white/5" />
            <div className="h-4 w-16 bg-white/10 dark:bg-white/5 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-white/10 dark:bg-white/5 rounded" />
              <div className="h-3 w-32 bg-white/10 dark:bg-white/5 rounded" />
            </div>
            <div className="h-5 w-16 bg-white/10 dark:bg-white/5 rounded-full" />
            <div className="h-4 w-20 bg-white/10 dark:bg-white/5 rounded" />
            <div className="flex gap-1.5">
              <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-white/5" />
              <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-white/5" />
              <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
