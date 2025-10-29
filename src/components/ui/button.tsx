import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold tracking-tight transition-all duration-200 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-sm hover:shadow-md active:shadow-sm active:translate-y-px aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40",
        outline:
          "border border-border bg-background text-foreground hover:bg-primary/10 hover:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "text-foreground/70 hover:text-foreground hover:bg-secondary/60",
        link:
          "text-primary underline-offset-4 hover:underline focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
        inverted:
          "bg-primary-foreground text-primary hover:bg-primary-foreground/90",
        contrast:
          "border border-primary-foreground/70 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary",
        subtle:
          "bg-primary/10 text-primary hover:bg-primary/20",
      },
      size: {
        default: "h-10 px-4 text-sm has-[>svg]:px-3",
        sm: "h-9 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-base has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const componentProps = asChild
      ? props
      : ({ ...props, type: type ?? "button" } as React.ComponentProps<"button">)

    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...componentProps}
      />
    )
  },
)

Button.displayName = "Button"

export { Button, buttonVariants }
