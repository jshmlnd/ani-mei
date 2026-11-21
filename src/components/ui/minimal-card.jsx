import * as React from "react"

import { cn } from "@/lib/utils"

// cult-ui MinimalCard, re-cut for Bead Board: a square plum mat around the
// poster. The outer frame (card-hover) owns the border and the lit state.
const MinimalCard = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("bg-[var(--r2)] p-2 transition-colors duration-100", className)} {...props}>
    {children}
  </div>
))
MinimalCard.displayName = "MinimalCard"

const MinimalCardImage = React.forwardRef(({ className, alt, src, ...props }, ref) => (
  <div ref={ref} className={cn("relative mb-4 h-[190px] w-full overflow-hidden", className)} {...props}>
    <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
  </div>
))
MinimalCardImage.displayName = "MinimalCardImage"

const MinimalCardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("mt-2 px-1 text-base leading-tight text-[var(--r7)]", className)} {...props} />
))
MinimalCardTitle.displayName = "MinimalCardTitle"

const MinimalCardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("px-1 pb-2 text-sm text-[var(--r5)]", className)} {...props} />
))
MinimalCardDescription.displayName = "MinimalCardDescription"

const MinimalCardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
))
MinimalCardContent.displayName = "MinimalCardContent"

const MinimalCardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-4 pt-0", className)} {...props} />
))
MinimalCardFooter.displayName = "MinimalCardFooter"

export {
  MinimalCard,
  MinimalCardImage,
  MinimalCardTitle,
  MinimalCardDescription,
  MinimalCardContent,
  MinimalCardFooter,
}

export default MinimalCard
