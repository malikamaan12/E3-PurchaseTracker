import { motion, AnimatePresence } from "framer-motion";

interface FormErrorTooltipProps {
  message?: string;
  className?: string;
}

export function FormErrorTooltip({ message, className }: FormErrorTooltipProps) {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -5, scale: 0.95 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              type: "spring",
              stiffness: 500,
              damping: 30
            }
          }}
          exit={{ 
            opacity: 0, 
            y: -5, 
            scale: 0.95,
            transition: { 
              duration: 0.2 
            }
          }}
          className={`absolute -bottom-6 left-0 z-50 ${className}`}
        >
          <div className="bg-destructive px-2 py-1 rounded-md shadow-lg">
            <p className="text-xs text-destructive-foreground">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}