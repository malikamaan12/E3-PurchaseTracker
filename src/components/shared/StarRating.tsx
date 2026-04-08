"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

interface StarRatingProps {
  rating: number;
  onRate?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

export function StarRating({ rating, onRate, readonly = false, size = 16 }: StarRatingProps) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          whileHover={readonly ? {} : { scale: 1.2 }}
          whileTap={readonly ? {} : { scale: 0.9 }}
          onClick={() => !readonly && onRate?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`transition-colors duration-200 ${
            readonly ? "cursor-default" : "cursor-pointer"
          }`}
          disabled={readonly}
        >
          <Star
            size={size}
            className={`${
              star <= (hover || rating)
                ? "fill-amber-400 text-amber-400"
                : "fill-zinc-800 text-zinc-600"
            } transition-all duration-300`}
          />
        </motion.button>
      ))}
      <span className="ml-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {rating > 0 ? rating.toFixed(1) : "Unrated"}
      </span>
    </div>
  );
}
