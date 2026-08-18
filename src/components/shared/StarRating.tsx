"use client";

import { Star } from "lucide-react";
import { useState } from "react";

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
        <button
          key={star}
          type="button"
          aria-label={readonly ? `${rating} stars` : `Rate ${star} out of 5 stars`}
          onClick={() => !readonly && onRate?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={`p-1.5 rounded-md min-w-[28px] min-h-[28px] flex items-center justify-center transition-transform duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
            readonly
              ? "cursor-default"
              : "cursor-pointer hover:scale-125 active:scale-90"
          }`}
          disabled={readonly}
          style={{ willChange: readonly ? "auto" : "transform" }}
        >
          <Star
            width={size}
            height={size}
            className={`${
              star <= (hover || rating)
                ? "fill-amber-400 text-amber-400"
                : "fill-muted/40 text-muted-foreground/40"
            } transition-colors duration-200`}
          />
        </button>
      ))}
      <span className="ml-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        {rating > 0 ? rating.toFixed(1) : "Unrated"}
      </span>
    </div>
  );
}
