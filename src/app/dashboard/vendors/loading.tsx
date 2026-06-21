export default function VendorsLoading() {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full animate-pulse">
      {/* Header skeleton */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-3">
          <div className="h-12 w-72 bg-white/10 dark:bg-white/5 rounded-xl" />
          <div className="h-4 w-80 bg-white/10 dark:bg-white/5 rounded-lg" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-20 bg-white/10 dark:bg-white/5 rounded-xl" />
          <div className="h-12 w-40 bg-white/10 dark:bg-white/5 rounded-2xl" />
        </div>
      </header>

      {/* Search bar skeleton */}
      <div className="glass rounded-[2rem] p-5 flex flex-col md:flex-row gap-6 items-center">
        <div className="h-14 flex-1 w-full bg-white/10 dark:bg-white/5 rounded-2xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 w-20 bg-white/10 dark:bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Vendor cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card overflow-hidden">
            <div className="p-8 pb-6 space-y-6">
              <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-3xl bg-white/10 dark:bg-white/5" />
                <div className="space-y-3 flex-1">
                  <div className="h-6 w-48 bg-white/10 dark:bg-white/5 rounded-lg" />
                  <div className="h-4 w-32 bg-white/10 dark:bg-white/5 rounded" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(j => (
                  <div key={j} className="h-16 bg-white/10 dark:bg-white/5 rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="h-20 bg-white/5 dark:bg-white/[0.02] border-y border-border/50" />
            <div className="h-14 bg-white/5 dark:bg-white/[0.01]" />
          </div>
        ))}
      </div>
    </div>
  );
}
