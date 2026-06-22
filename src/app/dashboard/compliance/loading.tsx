export default function ComplianceLoading() {
  return (
    <div className="relative min-h-screen p-8 w-full animate-pulse">
      {/* Header skeleton */}
      <header className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-12">
        <div className="max-w-xl space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 dark:bg-white/5 rounded-2xl w-14 h-14" />
            <div className="space-y-2">
              <div className="h-9 w-64 bg-white/10 dark:bg-white/5 rounded-xl" />
              <div className="h-3 w-80 bg-white/10 dark:bg-white/5 rounded" />
            </div>
          </div>
          <div className="h-12 w-full bg-white/10 dark:bg-white/5 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:w-auto min-w-[600px]">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass p-5 rounded-3xl space-y-4">
              <div className="h-3 w-24 bg-white/10 dark:bg-white/5 rounded" />
              <div className="h-10 w-20 bg-white/10 dark:bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
      </header>

      {/* Search bar skeleton */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-12 flex-1 bg-white/10 dark:bg-white/5 rounded-xl" />
        <div className="h-12 w-32 bg-white/10 dark:bg-white/5 rounded-xl" />
        <div className="h-12 w-40 bg-white/10 dark:bg-white/5 rounded-xl" />
      </div>

      {/* Table skeleton */}
      <div className="glass p-1 rounded-3xl">
        <div className="bg-white/40 dark:bg-white/[0.02] rounded-[22px] overflow-hidden">
          <div className="h-16 bg-white/5 dark:bg-white/[0.02] border-b border-white/5" />
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-8 px-6 py-6 border-b border-white/5">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-white/10 dark:bg-white/5 rounded" />
                <div className="h-3 w-56 bg-white/10 dark:bg-white/5 rounded" />
              </div>
              {[1, 2, 3, 4].map(j => (
                <div key={j} className="w-8 h-8 rounded-lg bg-white/10 dark:bg-white/5" />
              ))}
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/10 dark:bg-white/5 rounded-full" />
                <div className="h-4 w-10 bg-white/10 dark:bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
