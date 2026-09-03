import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-13 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-ghost focus-visible:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
