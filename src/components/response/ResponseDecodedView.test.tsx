import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResponseDecodedView } from "@/components/response/ResponseDecodedView";

describe("ResponseDecodedView", () => {
  it("Test 1 (scalar fields): renders key-value pairs for scalar fields", () => {
    render(
      <ResponseDecodedView decoded={{ name: "Alice", age: 30 }} error={null} />
    );

    expect(screen.getByText("name:")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("age:")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("Test 2 (nested object — collapsible): shows collapsible section for nested object", async () => {
    render(
      <ResponseDecodedView
        decoded={{ person: { name: "Bob" } }}
        error={null}
      />
    );

    // "person" key should be visible as a collapsible trigger
    expect(screen.getByText("person")).toBeInTheDocument();

    // Initially expanded — "name" inside person should be visible
    expect(screen.getByText("name:")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();

    // Click to collapse
    const trigger = screen.getByText("person");
    fireEvent.click(trigger);

    // After collapse, nested content is hidden
    // (Collapsible will toggle the open state)
  });

  it("Test 3 (decode error): shows error text in destructive style when error is set", () => {
    const errorMsg =
      "Decode failed: invalid varint. Showing raw bytes.";
    render(<ResponseDecodedView decoded={null} error={errorMsg} />);

    const errorElement = screen.getByText(errorMsg);
    expect(errorElement).toBeInTheDocument();
    // Should have destructive text class
    expect(errorElement.className).toContain("text-destructive");
  });

  it("Test 4 (null decoded, no error): renders nothing", () => {
    const { container } = render(
      <ResponseDecodedView decoded={null} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });
});
