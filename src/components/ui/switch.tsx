import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border-0 transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/35 data-[size=sm]:h-[14px] data-[size=sm]:w-6 data-checked:bg-primary data-unchecked:bg-surface-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3 rounded-full transition-transform data-checked:translate-x-[14px] data-checked:bg-white data-unchecked:translate-x-0.5 data-unchecked:bg-muted-foreground"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
