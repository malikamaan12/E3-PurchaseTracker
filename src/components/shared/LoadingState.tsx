"use client";

import { motion } from "framer-motion";

export function LoadingState({ message = "Synchronizing Data..." }: { message?: string }) {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto w-full h-[80vh] justify-center items-center">
      <div className="w-24 h-24 relative">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute inset-0 border-t-4 border-brand-secondary rounded-full"
        />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-4 bg-brand-primary/20 rounded-full"
        />
      </div>
      <p className="text-muted-foreground font-mono tracking-[0.4em] text-xs uppercase animate-pulse">
        {message}
      </p>
    </div>
  );
}
