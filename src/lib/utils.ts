import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Registers the design system's custom font-size scale (text-10 … text-20) as its
// own class group so it no longer collides with text-color utilities in tailwind-merge's
// default classification — without this, `cn("text-13", "text-ghost")` silently drops
// "text-13" because both get bucketed as "text color".
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["10", "11", "12", "13", "14", "15", "16", "20"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
