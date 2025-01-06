import { Skeleton } from "@/components/ui/skeleton";

export function LoadingFilterPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[60px]" />
      </div>
      
      {/* Skeleton items */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <div className="flex items-center gap-2 ml-8">
            <Skeleton className="h-3 w-[150px]" />
            <Skeleton className="h-3 w-[100px]" />
          </div>
        </div>
      ))}
      
      {/* Filter tags skeleton */}
      <div className="flex flex-wrap gap-2 mt-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-[80px] rounded-full" />
        ))}
      </div>
    </div>
  );
}
