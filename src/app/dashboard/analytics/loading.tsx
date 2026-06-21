export default function AnalyticsLoading() {
  return (
    <div className="flex-1 space-y-12 p-8 pt-6 max-w-[1440px] mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-white/10 dark:bg-white/5 rounded-lg" />
            <div className="h-1 w-px bg-border/20 mx-2" />
            <div className="h-10 w-64 bg-white/10 dark:bg-white/5 rounded-xl" />
          </div>
          <div className="h-3 w-96 bg-white/10 dark:bg-white/5 rounded" />
        </div>
        <div className="h-10 w-48 bg-white/10 dark:bg-white/5 rounded-xl" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-white/10 dark:bg-white/5 rounded" />
              <div className="w-12 h-12 rounded-2xl bg-white/10 dark:bg-white/5" />
            </div>
            <div className="h-10 w-32 bg-white/10 dark:bg-white/5 rounded-lg" />
            <div className="h-3 w-20 bg-white/10 dark:bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-full lg:col-span-4 glass-card p-8 space-y-6">
          <div className="h-6 w-48 bg-white/10 dark:bg-white/5 rounded-lg" />
          <div className="h-[350px] bg-white/5 dark:bg-white/[0.02] rounded-2xl" />
        </div>
        <div className="col-span-full lg:col-span-3 glass-card p-8 space-y-6">
          <div className="h-6 w-40 bg-white/10 dark:bg-white/5 rounded-lg" />
          <div className="h-[350px] bg-white/5 dark:bg-white/[0.02] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
