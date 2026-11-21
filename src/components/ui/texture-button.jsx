import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

// cult-ui TextureButton, re-cut for the Bead Board world: a flat square block
// with a 4px bead edge along the bottom that sinks when pressed.
const buttonVariantsOuter = cva(
  "group/texture-button inline-flex w-full select-none border-2 border-[var(--r0)] transition-transform duration-100 active:translate-y-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:bg-[var(--r1)] disabled:border-[var(--r4)]",
  {
    variants: {
      variant: {
        primary: "bg-[var(--accent)]",
        accent: "bg-[var(--accent)]",
        destructive: "bg-[var(--error)]",
        secondary: "bg-[var(--r3)]",
        minimal: "bg-[var(--r2)]",
        icon: "w-auto bg-[var(--r3)]",
      },
      size: { sm: "", default: "", lg: "", icon: "" },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
)

const innerDivVariants = cva(
  // Unavailable reads without colour: hollow block, label struck through.
  "flex h-full w-full items-center justify-center gap-2 whitespace-nowrap transition-colors duration-100 group-disabled/texture-button:!bg-transparent group-disabled/texture-button:!text-[var(--r5)] group-disabled/texture-button:!shadow-none group-disabled/texture-button:line-through group-disabled/texture-button:decoration-2",
  {
    variants: {
      variant: {
        primary: "text-[var(--r0)] shadow-[inset_0_-4px_0_var(--accent-deep)] group-hover/texture-button:bg-[var(--accent-deep)] group-active/texture-button:shadow-[inset_0_-2px_0_var(--accent-deep)]",
        accent: "text-[var(--r0)] shadow-[inset_0_-4px_0_var(--accent-deep)] group-hover/texture-button:bg-[var(--accent-deep)] group-active/texture-button:shadow-[inset_0_-2px_0_var(--accent-deep)]",
        destructive: "text-[var(--r0)] shadow-[inset_0_-4px_0_var(--r4)]",
        secondary: "text-[var(--r7)] shadow-[inset_0_-4px_0_var(--r2)] group-hover/texture-button:bg-[var(--r4)] group-active/texture-button:shadow-[inset_0_-2px_0_var(--r2)]",
        minimal: "text-[var(--r6)] shadow-[inset_0_-4px_0_var(--r1)] group-hover/texture-button:text-[var(--r7)] group-hover/texture-button:bg-[var(--r3)]",
        icon: "text-[var(--r7)] shadow-[inset_0_-4px_0_var(--r2)] group-hover/texture-button:text-[var(--accent)]",
      },
      size: {
        sm: "min-h-9 px-3 pb-1 pt-0.5 text-sm",
        default: "min-h-11 px-4 pb-1.5 pt-1 text-base",
        lg: "min-h-12 px-6 pb-1.5 pt-1 text-lg",
        icon: "size-10 pb-1",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
)

const TextureButton = React.forwardRef((
  { children, variant = "primary", size = "default", asChild = false, className, ...props },
  ref
) => {
  const outer = cn(buttonVariantsOuter({ variant, size }), className)
  const inner = (content) => (
    <div className={cn(innerDivVariants({ variant, size }))}>{content}</div>
  )

  // asChild: the child (e.g. a router <Link>) becomes the outer element and
  // keeps the inner bead-edge div around its own children.
  if (asChild && React.isValidElement(children)) {
    return (
      <Slot className={outer} ref={ref} {...props}>
        {React.cloneElement(children, undefined, inner(children.props.children))}
      </Slot>
    )
  }

  return (
    <button className={outer} ref={ref} {...props}>
      {inner(children)}
    </button>
  )
})

TextureButton.displayName = "TextureButton"

export { TextureButton }
