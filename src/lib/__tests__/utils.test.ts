import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("keeps a custom font-size class alongside a text-color class", () => {
    expect(cn("text-13 text-ghost")).toBe("text-13 text-ghost");
  });

  it("still resolves conflicts between two custom font-size classes", () => {
    expect(cn("text-13", "text-11")).toBe("text-11");
  });

  it("still resolves conflicts between a custom font-size class and an arbitrary one", () => {
    expect(cn("text-13", "text-[12.5px]")).toBe("text-[12.5px]");
  });

  it("still resolves conflicting border-radius classes", () => {
    expect(cn("rounded-md", "rounded-xs")).toBe("rounded-xs");
  });
});
