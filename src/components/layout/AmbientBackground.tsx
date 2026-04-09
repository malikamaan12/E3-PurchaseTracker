"use client";

import { usePerformance } from "@/context/PerformanceContext";

export default function AmbientBackground() {
  const { highPerformanceMode } = usePerformance();

  if (highPerformanceMode) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none select-none -z-10">
      <div 
        className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-brand-primary/15 dark:bg-brand-primary/25 rounded-full blur-[60px] animate-fluid-drift" 
        style={{ willChange: 'transform' }}
      />
      <div 
        className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-brand-secondary/15 dark:bg-brand-secondary/25 rounded-full blur-[60px] animate-fluid-drift [animation-delay:2.5s]" 
        style={{ willChange: 'transform' }}
      />
      <div 
        className="absolute top-[30%] right-[5%] w-[35%] h-[35%] bg-brand-mid/10 dark:bg-brand-mid/20 rounded-full blur-[55px] animate-fluid-drift [animation-delay:5s]" 
        style={{ willChange: 'transform' }}
      />
      <div 
        className="absolute bottom-[20%] left-[30%] w-[30%] h-[30%] bg-[#A78BFA]/5 dark:bg-[#A78BFA]/10 rounded-full blur-[50px] animate-fluid-drift [animation-delay:7.5s]" 
        style={{ willChange: 'transform' }}
      />
      
      {/* Fine grain overlay for premium texture */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none brightness-100 contrast-150" style={{ backgroundImage: "url('/noise.svg')" }} />
    </div>
  );
}
