import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

// cult-ui GradientHeading, re-cut for Bead Board: pixel type has no room for a
// gradient, so emphasis comes from size and one solid ramp colour.
const headingVariants = cva("leading-tight", {
  variants: {
    variant: {
      default: "text-[var(--r7)]",
      animei: "text-[var(--r7)]",
      pink: "text-[var(--accent)]",
      light: "text-[var(--r6)]",
      secondary: "text-[var(--r5)]",
    },
    size: {
      default: "text-2xl sm:text-3xl lg:text-4xl",
      xxs: "text-base sm:text-lg",
      xs: "text-xl sm:text-2xl",
      sm: "text-2xl sm:text-3xl",
      md: "text-2xl sm:text-3xl lg:text-4xl",
      lg: "text-3xl sm:text-4xl lg:text-5xl",
      xl: "text-4xl sm:text-5xl lg:text-6xl",
      xll: "text-4xl sm:text-6xl",
      xxl: "text-5xl sm:text-6xl",
      xxxl: "text-5xl sm:text-6xl",
    },
    weight: { default: "", thin: "", base: "", semi: "", bold: "", black: "" },
  },
  defaultVariants: { variant: "default", size: "default", weight: "default" },
})

const GradientHeading = React.forwardRef(
  ({ asChild, as = "h3", variant, weight, size, className, children, ...props }, ref) => {
    const Comp = asChild ? Slot : as
    return (
      <Comp ref={ref} {...props} className={cn(headingVariants({ variant, size, weight }), className)}>
        {children}
      </Comp>
    )
  }
)

GradientHeading.displayName = "GradientHeading"

export { GradientHeading }
