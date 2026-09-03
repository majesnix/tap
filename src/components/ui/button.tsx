import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-13 font-medium whitespace-nowrap transition-[color,background-color,filter,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/35 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground font-semibold hover:brightness-110 hover:shadow-glow",
        outline:
          "border border-border bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2",
        secondary: "bg-surface-2 text-foreground hover:bg-surface-3",
        ghost:
          "text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2",
        destructive: "bg-danger/12 text-danger hover:bg-danger/20",
        link: "text-violet-bright hover:text-foreground",
      },
      size: {
        default: "h-[30px] px-3",
        xs: "h-[26px] px-2 text-12 rounded-sm",
        sm: "h-7 px-2.5 text-12",
        md: "h-[34px] px-3.5",
        lg: "h-9 px-3.5 pr-2",
        icon: "size-7 rounded-sm",
        "icon-xs": "size-[22px] rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
