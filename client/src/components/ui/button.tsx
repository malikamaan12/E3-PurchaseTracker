import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:-translate-y-[1px]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md hover:-translate-y-[1px]",
        outline:
          "border border-border bg-background text-text-primary dark:text-text-primary hover:border-primary hover:shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:shadow-md hover:-translate-y-[1px]",
        ghost: "shadow-none hover:bg-muted hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
        success: "bg-success text-success-foreground hover:bg-success/90 hover:shadow-md hover:-translate-y-[1px]",
        gradient: "bg-gradient-primary text-white hover:shadow-md hover:-translate-y-[1px]",
      },
      size: {
        default: "h-12 min-h-12 px-5 py-3 text-base",
        sm: "h-10 min-h-10 rounded-md px-4 py-2 text-sm",
        lg: "h-14 min-h-14 rounded-md px-8 py-4 text-lg",
        icon: "h-12 w-12 min-h-12 min-w-12",
        "icon-sm": "h-10 w-10 min-h-10 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          "font-medium"
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
