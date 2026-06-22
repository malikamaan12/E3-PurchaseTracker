"use client";

export function LoadingState({ message = "Synchronizing Data..." }: { message?: string }) {
  return (
    <div className="flex flex-col gap-8 p-8 w-full h-[80vh] justify-center items-center">
      <div className="w-24 h-24 relative">
        {/* CSS spinner — hardware-accelerated, no JS animation loop */}
        <div className="absolute inset-0 border-t-4 border-brand-secondary rounded-full spin-css" />
        {/* CSS pulse ring */}
        <div className="absolute inset-4 bg-brand-primary/20 rounded-full pulse-css" />
      </div>
      <p className="text-muted-foreground font-mono tracking-[0.4em] text-xs uppercase animate-pulse">
        {message}
      </p>
    </div>
  );
}
