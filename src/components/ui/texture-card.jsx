import * as React from "react"

import { cn } from "@/lib/utils"

// cult-ui TextureCard, re-cut for Bead Board: a square plum panel with a 4px
// ink border and one inner hairline, the pegboard's frame.
const TextureCard = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("border-4 border-[var(--r0)] bg-[var(--r2)]", className)} {...props}>
    <div className="h-full border-2 border-[var(--r3)] text-[var(--r6)]">{children}</div>
  </div>
))
TextureCard.displayName = "TextureCard"

const TextureCardStyled = TextureCard

const TextureCardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-5 pt-5", className)} {...props} />
))
TextureCardHeader.displayName = "TextureCardHeader"

const TextureCardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-lg leading-tight text-[var(--r7)]", className)} {...props} />
))
TextureCardTitle.displayName = "TextureCardTitle"

const TextureCardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-[var(--r5)]", className)} {...props} />
))
TextureCardDescription.displayName = "TextureCardDescription"

const TextureCardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-5 py-4", className)} {...props} />
))
TextureCardContent.displayName = "TextureCardContent"

const TextureCardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center justify-between gap-2 px-5 py-4", className)} {...props} />
))
TextureCardFooter.displayName = "TextureCardFooter"

const TextureSeparator = () => <div className="border-t-2 border-[var(--r3)]" />

export {
  TextureCard,
  TextureCardHeader,
  TextureCardStyled,
  TextureCardFooter,
  TextureCardTitle,
  TextureSeparator,
  TextureCardDescription,
  TextureCardContent,
}

export default TextureCard
