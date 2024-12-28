import { motion, AnimatePresence } from "framer-motion";

interface FormErrorTooltipProps {
  message?: string;
}

export function FormErrorTooltip({ message }: FormErrorTooltipProps) {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30
          }}
          className="absolute -bottom-6 left-0 z-50"
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
