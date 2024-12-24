import { type VariantProps, cva } from "class-variance-authority";

export const fadeInVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

export const slideInFromRight = {
  initial: { x: 20, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -20, opacity: 0 }
};

export const pulseAnimation = {
  initial: { scale: 1 },
  animate: { 
    scale: [1, 1.02, 1],
    transition: { duration: 0.3 }
  }
};

export const buttonVariants = cva(
  "inline-flex items-center justify-center transition-all duration-200 ease-in-out active:scale-95",
  {
    variants: {
      variant: {
        default: "hover:brightness-110",
        ghost: "hover:bg-opacity-90",
        outline: "hover:bg-opacity-10"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-8",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export const inputVariants = cva(
  "transition-all duration-200 ease-in-out focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "focus:ring-primary/20",
        error: "focus:ring-destructive/20 border-destructive"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export type ButtonVariantsProps = VariantProps<typeof buttonVariants>;
export type InputVariantsProps = VariantProps<typeof inputVariants>;
