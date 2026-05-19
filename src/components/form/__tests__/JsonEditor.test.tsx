import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, test, expect } from "vitest";
import { JsonEditor } from "../JsonEditor";

// MANDATORY: mock CodeMirror before any import of JsonEditor
// CodeMirror uses ContentEditable internally — jsdom does not support it
// (GitHub issue: uiwjs/react-codemirror#506)
vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="codemirror-stub"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const noop = () => {};

describe("JsonEditor", () => {
  // ─── render ────────────────────────────────────────────────────────
  test("renders CodeMirror stub pre-filled with initialValue", () => {
    render(
      <JsonEditor
        value='{"foo":"bar"}'
        onChange={noop}
        resolvedTheme="light"
        parseError={null}
        onFixJson={noop}
        onDiscard={noop}
      />
    );
    const stub = screen.getByTestId("codemirror-stub");
    expect(stub).toHaveValue('{"foo":"bar"}');
  });

  // ─── onChange ──────────────────────────────────────────────────────
  test("calls onChange when editor content changes", () => {
    const handleChange = vi.fn();
    render(
      <JsonEditor
        value="{}"
        onChange={handleChange}
        resolvedTheme="light"
        parseError={null}
        onFixJson={noop}
        onDiscard={noop}
      />
    );
    fireEvent.change(screen.getByTestId("codemirror-stub"), {
      target: { value: '{"x":1}' },
    });
    expect(handleChange).toHaveBeenCalledWith('{"x":1}');
  });

  // ─── parse error banner — hidden ───────────────────────────────────
  test("does not render error banner when parseError is null", () => {
    render(
      <JsonEditor
        value="{}"
        onChange={noop}
        resolvedTheme="light"
        parseError={null}
        onFixJson={noop}
        onDiscard={noop}
      />
    );
    expect(screen.queryByText("Invalid JSON")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // ─── parse error banner — visible ──────────────────────────────────
  test("renders error banner with role=alert when parseError is non-null", () => {
    render(
      <JsonEditor
        value="{bad}"
        onChange={noop}
        resolvedTheme="light"
        parseError="Unexpected token b"
        onFixJson={noop}
        onDiscard={noop}
      />
    );
    expect(screen.getByText("Invalid JSON")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Unexpected token b");
  });

  // ─── Fix JSON button ───────────────────────────────────────────────
  test("calls onFixJson when Fix JSON button is clicked", () => {
    const handleFixJson = vi.fn();
    render(
      <JsonEditor
        value="{bad}"
        onChange={noop}
        resolvedTheme="light"
        parseError="Unexpected token"
        onFixJson={handleFixJson}
        onDiscard={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Fix JSON" }));
    expect(handleFixJson).toHaveBeenCalledTimes(1);
  });

  // ─── Discard changes button ────────────────────────────────────────
  test("calls onDiscard when Discard changes button is clicked", () => {
    const handleDiscard = vi.fn();
    render(
      <JsonEditor
        value="{bad}"
        onChange={noop}
        resolvedTheme="light"
        parseError="Unexpected token"
        onFixJson={noop}
        onDiscard={handleDiscard}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(handleDiscard).toHaveBeenCalledTimes(1);
  });

  // ─── dark mode theme prop ─────────────────────────────────────────
  test("renders without error when resolvedTheme is dark", () => {
    render(
      <JsonEditor
        value="{}"
        onChange={noop}
        resolvedTheme="dark"
        parseError={null}
        onFixJson={noop}
        onDiscard={noop}
      />
    );
    expect(screen.getByTestId("codemirror-stub")).toBeInTheDocument();
  });
});
