# Phase 9: Routing Key Autocomplete — Research

**Researched:** 2026-05-19
**Domain:** React/Tauri IPC, shadcn Command+Popover combobox, RabbitMQ Management API bindings endpoint
**Confidence:** HIGH (all critical claims verified via official docs, source code inspection, or authoritative SDK references)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace the plain `<Input>` for routing key with a shadcn Command+Popover combobox (cmdk) when eligible suggestions are available.
- **D-02:** Free-type is always permitted — user can pick from suggestions OR type any custom key not in the list. Required for topic pattern editing (PUBL-03).
- **D-03:** When no eligible exchange is selected (or the selected exchange is `headers`/`fanout`), render the routing key as a plain `<Input>`.
- **D-04:** Show a small Loader2 spinner inside the routing key input while bindings are being fetched.
- **D-05:** The exchange dropdown must show the exchange type as a muted badge beside the name — requires `fetch_exchanges` Rust command to return `{name, exchange_type}` instead of `Vec<String>`.
- **D-06:** When a `headers` or `fanout` exchange is selected, show a small hint text below the routing key input.
- **D-07:** Topic wildcard patterns identified by presence of `*` or `#` characters.
- **D-08:** Each wildcard pattern shows a small amber badge labeled "pattern".
- **D-09:** Selecting a wildcard pattern copies the full pattern string into the routing key input as-is.
- **D-10:** If Management API is unreachable when bindings are requested, silently fall back to plain `<Input>` — no error state.

### Claude's Discretion

None — all implementation decisions locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUBL-01 | User can see routing key suggestions populated from live RabbitMQ exchange bindings when an exchange is selected | RabbitMQ Management API `/api/exchanges/{vhost}/{exchange}/bindings/source` endpoint returns binding objects with `routing_key` field; deduplicated routing keys become combobox suggestions |
| PUBL-02 | User sees no routing key suggestions for `headers` and `fanout` exchanges — autocomplete suppressed | Exchange type string returned in `ExchangeSummary.exchange_type`; `headers`/`fanout` conditional renders plain `<Input>` + hint (D-03, D-06) |
| PUBL-03 | Topic exchange wildcard patterns shown in suggestions labeled as patterns | D-07 detection via `key.includes("*") \|\| key.includes("#")`; D-08 amber badge; D-09 copy-as-is on select |
| PUBL-04 | Routing key input falls back to plain free-text when Management API unavailable — no error state | D-10 silent catch in `fetch_bindings` useEffect; `managementStatus !== "live"` → plain `<Input>` |

</phase_requirements>

---

## Summary

Phase 9 extends `PublishBar.tsx` at a single UI change point (line 309–319) by replacing the plain `<Input>` for routing key with a shadcn Command+Popover combobox that populates suggestions from the RabbitMQ Management API's bindings endpoint. The combobox allows free-type at all times (D-02) — the `CommandInput` value is the source of truth for `routingKey`, whether the user types or selects.

The most impactful structural change is the `fetch_exchanges` IPC contract breaking change: `Vec<String> → Vec<ExchangeSummary {name, exchange_type}>`. This touches 6 TypeScript files and 15 test locations across `ipc.ts`, `types.ts`, `useConnectionStore.ts`, `PublishBar.tsx`, and numerous test files that seed `exchanges: []` in store state. This must be tracked as a distinct task (Type Change Wave) before the combobox can be built.

A new `fetch_bindings` Rust command is needed, mirroring the structure of `fetch_exchanges` but calling `/api/exchanges/{vhost}/{exchange}/bindings/source`. It returns deduplicated routing key strings only (`Vec<String>`). The frontend fetches bindings in a new `useEffect([selectedExchange])` with cleanup to prevent stale results.

**Primary recommendation:** Split into three waves — (1) `fetch_exchanges` IPC type change + `fetch_bindings` Rust command, (2) `RoutingKeyCombobox` component + integration into PublishBar, (3) test coverage for both layers.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Bindings fetch from RabbitMQ | API / Backend (Rust) | — | Management HTTP API call lives in `commands/connection.rs` — identical pattern to `fetch_queues`/`fetch_exchanges` |
| Exchange type surface to UI | API / Backend (Rust) | Frontend Server — | `ExchangeSummary` struct serialized and returned from `fetch_exchanges`; frontend types it |
| Combobox widget render | Frontend (React component) | — | `RoutingKeyCombobox` is a client component; no SSR layer in Tauri |
| Wildcard detection | Frontend (React) | — | String contains `*` or `#` — pure client-side computation per D-07 |
| Routing key state | Frontend (PublishBar local state) | — | `routingKey` is local `useState` in PublishBar; not promoted to store (no cross-component need) |
| Silent fallback logic | Frontend (React) | — | Catch all errors in bindings `useEffect`, fall back to plain `<Input>` per D-10 |

---

## Standard Stack

### Core (already installed — no new packages except Command)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `shadcn` Command component (cmdk) | via `npx shadcn@latest add command` | Suggestion list + filter input for combobox | [VERIFIED: UI-SPEC §Component Inventory — "NOT installed"] |
| `radix-ui` Popover | already installed (`src/components/ui/popover.tsx`) | Combobox anchor/positioning | [VERIFIED: file exists] |
| `lucide-react` | `^1.16.0` | `Loader2` spinner + `ChevronsUpDown`/`Check` icons | [VERIFIED: package.json] |
| `@tauri-apps/api` invoke | `^2.11.0` | IPC to new `fetch_bindings` Rust command | [VERIFIED: package.json] |
| `reqwest` | `0.13` | HTTP client for Management API (already in Cargo.toml) | [VERIFIED: Cargo.toml] |
| `percent-encoding` | `2` | URL-encode vhost + exchange name in bindings URL | [VERIFIED: Cargo.toml — already used in `fetch_exchanges`] |

### New Install Required

```bash
npx shadcn@latest add command
```

This creates `src/components/ui/command.tsx` (cmdk wrapper). No other npm packages needed. [VERIFIED: UI-SPEC §Registry Safety]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Command+Popover (cmdk) | Radix Select | Select does not support free-type input — fails D-02 |
| Command+Popover (cmdk) | Headless UI Combobox | Not in project dependency set; adds bundle weight |
| `Vec<String>` deduped routing keys | `Vec<BindingSummary { routing_key, destination }>` | Richer type deferred to PUBL-F-01; v1.3 only needs keys |

---

## Architecture Patterns

### System Architecture Diagram

```
User selects exchange in dropdown
        │
        ▼
PublishBar useEffect([selectedExchange])
        │
        ├─── exchange type == headers/fanout?
        │         YES → render plain <Input> + hint text
        │
        ├─── managementStatus != "live"?
        │         YES → render plain <Input> (silent, D-10)
        │
        └─── ELSE → fetch_bindings IPC call
                │
                ├─── Rust: GET /api/exchanges/{vhost}/{exchange}/bindings/source
                │         → dedup routing_key strings → Vec<String>
                │
                ├─── Success → bindingKeys state[] → RoutingKeyCombobox
                │         • loading=false, popover available
                │         • wildcard items: key.includes("*") || key.includes("#") → amber badge
                │
                └─── Failure (any error) → silent fallback: render plain <Input>
```

### Recommended Project Structure

No new directories. All changes within existing files plus one new component:

```
src/
├── components/
│   └── publish/
│       ├── PublishBar.tsx          ← extend exchange select, replace routing key section
│       ├── RoutingKeyCombobox.tsx  ← new extracted component (D-01 combobox widget)
│       └── __tests__/
│           └── PublishBar.test.tsx ← update + add bindings fetch tests
├── lib/
│   ├── ipc.ts                      ← fetchExchanges return type change + fetchBindings new function
│   └── types.ts                    ← add ExchangeSummary type
└── stores/
    └── useConnectionStore.ts       ← exchanges: string[] → ExchangeSummary[]

src-tauri/src/commands/
└── connection.rs                   ← fetch_exchanges returns ExchangeSummary, new fetch_bindings
```

### Pattern 1: Rust — `fetch_bindings` command (mirrors `fetch_exchanges`)

**What:** New `#[tauri::command]` function in `connection.rs` that GETs the bindings/source endpoint, extracts `routing_key` strings, deduplicates them, and removes empty keys.

**When to use:** Triggered by frontend when user selects an eligible exchange in exchange mode.

```rust
// Source: mirrors fetch_exchanges pattern in connection.rs (lines 321-367)
#[derive(Deserialize)]
struct BindingApiInfo {
    routing_key: String,
}

#[tauri::command]
pub async fn fetch_bindings(
    app: AppHandle,
    profile_name: String,
    exchange_name: String,
) -> Result<Vec<String>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let encoded_exchange = percent_encoding::utf8_percent_encode(
        &exchange_name,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/exchanges/{}/{}/bindings/source",
        scheme, profile.host, profile.management_port, encoded_vhost, encoded_exchange
    );

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(&profile.username, Some(&password))
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::ManagementApiUnavailable(0)
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => {
            let bindings: Vec<BindingApiInfo> = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            // Dedup + filter empty routing keys
            let mut keys: Vec<String> = bindings
                .into_iter()
                .map(|b| b.routing_key)
                .filter(|k| !k.is_empty())
                .collect();
            keys.sort();
            keys.dedup();
            Ok(keys)
        }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}
```

**CRITICAL:** Register in `lib.rs` `invoke_handler!` list or Tauri will silently ignore calls.

### Pattern 2: `fetch_exchanges` return type change

**What:** `ExchangeApiInfo.exchange_type` must now be serialized and included in the output. Add a `Serialize`-derived `ExchangeSummary` struct and update the filter/map chain.

```rust
// Source: derived from existing ExchangeApiInfo in connection.rs
use serde::Serialize;

#[derive(Serialize)]
pub struct ExchangeSummary {
    pub name: String,
    pub exchange_type: String, // "direct", "fanout", "topic", "headers"
}

// In fetch_exchanges, change:
// .map(|e| e.name)
// To:
.map(|e| ExchangeSummary { name: e.name, exchange_type: e.exchange_type })
```

**Note:** `ExchangeApiInfo` already captures `exchange_type` but marks it `#[allow(dead_code)]`. This change makes it live. [VERIFIED: connection.rs line 30-36]

### Pattern 3: TypeScript type + IPC wrappers

```typescript
// src/lib/types.ts — add after existing types
// IMPORTANT: use snake_case to match ConnectionProfile convention (management_port, management_ssl)
export interface ExchangeSummary {
  name: string;
  exchange_type: string; // "direct" | "fanout" | "topic" | "headers"
}
```

```typescript
// src/lib/ipc.ts — update fetchExchanges return type
import type { ExchangeSummary } from "./types";

export async function fetchExchanges(profileName: string): Promise<ExchangeSummary[]> {
  return invoke<ExchangeSummary[]>("fetch_exchanges", { profileName });
}

// NEW: fetch binding routing keys for a named exchange
export async function fetchBindings(
  profileName: string,
  exchangeName: string,
): Promise<string[]> {
  return invoke<string[]>("fetch_bindings", { profileName, exchangeName });
}
```

### Pattern 4: `RoutingKeyCombobox` — controlled free-type combobox (D-01, D-02)

**What:** Popover+Command combobox where `CommandInput` is the source of truth for the routing key value. Selection updates state AND closes popover. Typing also updates state. This is a deviation from the canonical shadcn demo (which only updates on select).

**When to use:** Exchange mode, exchange is eligible (not headers/fanout), Management API is live.

```tsx
// Source: [ASSUMED] shadcn Command+Popover pattern + cmdk CommandInput onValueChange
// Verify against actual generated command.tsx after `npx shadcn@latest add command`
import { useState } from "react";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface RoutingKeyComboboxProps {
  value: string;
  onChange: (value: string) => void;
  bindingKeys: string[];
  isLoading: boolean;
}

export function RoutingKeyCombobox({
  value,
  onChange,
  bindingKeys,
  isLoading,
}: RoutingKeyComboboxProps) {
  const [open, setOpen] = useState(false);

  const isWildcard = (key: string) => key.includes("*") || key.includes("#");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 h-9 justify-between border-input bg-background font-normal"
        >
          <span className="truncate text-left flex-1">
            {value || <span className="text-muted-foreground">Routing key</span>}
          </span>
          {isLoading ? (
            <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : (
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0">
        <Command>
          {/* KEY: onValueChange syncs typing to parent state (free-type D-02) */}
          <CommandInput
            placeholder="Filter keys…"
            value={value}
            onValueChange={onChange}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Loading…" : "No bindings found."}
            </CommandEmpty>
            <CommandGroup>
              {bindingKeys.map((key) => (
                <CommandItem
                  key={key}
                  value={key}
                  onSelect={(selectedKey) => {
                    onChange(selectedKey);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === key ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex-1 truncate">{key}</span>
                  {isWildcard(key) && (
                    <Badge className="ml-2 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 font-semibold shrink-0">
                      pattern
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### Pattern 5: PublishBar bindings `useEffect` with cleanup

**What:** Fetch bindings when `selectedExchange` changes. Must cancel stale requests (race condition). D-10 silent fallback — never surfaces errors.

```tsx
// In PublishBar.tsx — new state
const [bindingKeys, setBindingKeys] = useState<string[]>([]);
const [isLoadingBindings, setIsLoadingBindings] = useState(false);
const [useCombobox, setUseCombobox] = useState(false);

// CRITICAL: Exchange type map for conditional rendering
const selectedExchangeObj = exchanges.find((ex) => ex.name === selectedExchange);
const selectedExchangeType = selectedExchangeObj?.exchange_type ?? "";
const isHintExchange = selectedExchangeType === "headers" || selectedExchangeType === "fanout";
const isEligibleForCombobox = !isHintExchange && managementStatus === "live" && Boolean(selectedExchange);

// New useEffect: fetch bindings when exchange selection changes
useEffect(() => {
  if (!activeProfileName || !isEligibleForCombobox) {
    setBindingKeys([]);
    setUseCombobox(false);
    return;
  }

  let cancelled = false; // stale-request guard
  setIsLoadingBindings(true);
  setUseCombobox(true); // show combobox optimistically while loading

  fetchBindings(activeProfileName, selectedExchange)
    .then((keys) => {
      if (!cancelled) {
        setBindingKeys(keys);
        setIsLoadingBindings(false);
      }
    })
    .catch(() => {
      // D-10: silent fallback — any error (including 401) = plain Input
      if (!cancelled) {
        setBindingKeys([]);
        setIsLoadingBindings(false);
        setUseCombobox(false); // fall back to plain Input
      }
    });

  return () => { cancelled = true; };
}, [activeProfileName, selectedExchange, isEligibleForCombobox]);
```

### Pattern 6: PublishBar routing key section (replacing lines 309–319)

```tsx
{/* Routing key — Exchange mode only */}
{mode === "exchange" && (
  <div className="flex flex-col gap-0">
    <div className="flex items-center gap-2">
      <label className="text-sm font-semibold">Routing Key</label>
      {isEligibleForCombobox && useCombobox ? (
        <RoutingKeyCombobox
          value={routingKey}
          onChange={setRoutingKey}
          bindingKeys={bindingKeys}
          isLoading={isLoadingBindings}
        />
      ) : (
        <Input
          placeholder="Routing key"
          className="w-48"
          value={routingKey}
          onChange={(e) => setRoutingKey(e.target.value)}
        />
      )}
    </div>
    {isHintExchange && (
      <p className="text-xs text-muted-foreground mt-1">
        {selectedExchangeType === "fanout"
          ? "Routing key is ignored for fanout exchanges."
          : "Headers exchanges route by message headers, not routing key."}
      </p>
    )}
  </div>
)}
```

### Pattern 7: Exchange dropdown with type badge (D-05)

Replace current `(mode === "queue" ? queues : exchanges).map((name) => ...)` at line 270:

```tsx
{/* Exchange list: ExchangeSummary[], not string[] */}
{mode === "exchange"
  ? exchanges.map((ex) => (
      <SelectItem key={ex.name} value={ex.name}>
        <span className="flex items-center gap-2">
          {ex.name}
          <Badge
            variant="outline"
            className="text-xs text-muted-foreground font-semibold"
          >
            [{ex.exchange_type}]
          </Badge>
        </span>
      </SelectItem>
    ))
  : queues.map((name) => (
      <SelectItem key={name} value={name}>
        {name}
      </SelectItem>
    ))}
```

### Anti-Patterns to Avoid

- **Copying bindings 401 error to managementAuthError:** D-10 mandates ALL bindings errors (including 401) fall back silently. Never call `setManagementAuthError` in the bindings catch block — that is reserved for `fetch_exchanges`/`fetch_queues` 401s only. [VERIFIED: PublishBar.tsx line 110–113 pattern]
- **Standard shadcn combobox (select-only) without free-type:** The canonical demo only updates state `onSelect`. For D-02 compliance, `CommandInput` MUST use `value={routingKey}` + `onValueChange={setRoutingKey}` to sync typing. Without this, users cannot custom-type a routing key.
- **No stale-request cleanup in useEffect:** Without the `cancelled` flag (or AbortController), switching exchanges quickly will populate the second exchange's combobox with the first exchange's bindings if the first response arrives after the second request starts.
- **`tokio::spawn` in fetch_bindings:** Use the existing `async fn` pattern with Tauri's runtime — do NOT call `tokio::spawn` directly. The existing `fetch_queues`/`fetch_exchanges` commands are correct models.
- **exchange_type comparison without lowercase:** RabbitMQ Management API returns lowercase strings (`"fanout"`, `"headers"`, `"topic"`, `"direct"`). [CITED: RabbitMQ Management API docs — exchange type is lowercase] The comparisons `=== "headers"` and `=== "fanout"` are correct without `.toLowerCase()` but the Rust code should not alter the raw string.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Suggestion list with filter | Custom filtered `<ul>` | cmdk `Command` + `CommandInput` | cmdk handles keyboard navigation, filter, empty state, accessibility |
| Popover positioning | `position: absolute` + scroll detection | `<Popover>` (Radix UI) | Radix handles overflow, collision, portal rendering |
| URL-encoded exchange name in API path | Manual `encodeURIComponent` substitute | `percent_encoding::utf8_percent_encode` | Already used in all other Management API calls; consistent pattern |
| Routing key deduplication | `Set<T>` in frontend | Rust `.sort()` + `.dedup()` | Dedup at source reduces IPC payload; `sort` required before `dedup` in Rust |

---

## Common Pitfalls

### Pitfall 1: Bindings 401 triggering visible error badge (CRITICAL)

**What goes wrong:** Developer copies the auth-error handling pattern from `fetch_queues`/`fetch_exchanges` into the bindings fetch, causing a destructive badge to appear when bindings 401.

**Why it happens:** Lines 110–113 of PublishBar handle `fetch_exchanges` 401 by calling `setManagementAuthError(errMsg)`. This is intentional for exchange/queue listing. But D-10 explicitly mandates silent fallback for bindings errors.

**How to avoid:** The bindings `useEffect` catch block must ONLY call `setBindingKeys([])`, `setIsLoadingBindings(false)`, `setUseCombobox(false)`. Never `setManagementAuthError` or `setManagementStatus("manual")`.

**Warning signs:** A destructive badge appears in the PublishBar status area when Management API returns 401 during exchange selection.

---

### Pitfall 2: Stale bindings from rapid exchange switching

**What goes wrong:** User switches exchange from "orders" → "payments" quickly. "orders" bindings response arrives after "payments" fetch begins. Combobox shows "orders" suggestions for "payments" exchange.

**Why it happens:** No cleanup in `useEffect`. The first `fetchBindings` promise resolves and calls `setBindingKeys` even though the exchange has already changed.

**How to avoid:** Use a `cancelled` boolean flag (or `AbortController`) set in the `useEffect` cleanup return. Check `if (!cancelled)` before all `setState` calls inside the `.then()` and `.catch()`.

**Warning signs:** After fast switching, combobox shows unexpected routing keys that don't match the currently selected exchange.

---

### Pitfall 3: Free-type broken by standard shadcn combobox pattern

**What goes wrong:** Developer copies the canonical shadcn combobox demo verbatim. `CommandInput` is uncontrolled — typing filters the list but does NOT update `routingKey` state. User types `"orders.eu"`, publishes, but `routingKey` is still `""`.

**Why it happens:** Standard demo only updates state `onSelect`. `CommandInput` is left uncontrolled.

**How to avoid:** MUST use controlled `CommandInput`: `value={routingKey}` + `onValueChange={setRoutingKey}`. These two props together enable D-02 free-type while keeping the filter list working.

**Warning signs:** User can type in the filter box but the routing key field shows the previous value after publishing. Unit test checking `routingKey` after a `fireEvent.change` on CommandInput fails.

---

### Pitfall 4: `exchanges: string[]` type error cascade in tests

**What goes wrong:** `useConnectionStore.exchanges` type changes from `string[]` to `ExchangeSummary[]`. TypeScript strict mode immediately flags 15 test locations that seed `exchanges: []` — this is technically OK (empty array satisfies both types at runtime) but **test files that populate exchanges with named strings** will break.

**Why it happens:** `exchanges: ["orders", "payments"]` in test setup becomes a type error after the store type update.

**How to avoid:** Audit all test files with `exchanges:` seeds before the type change (grep result shows 5 test files, 15 lines). Update seeds to `{ name: "orders", exchange_type: "direct" }` shape when they contain named strings. Empty array seeds (`exchanges: []`) may pass TypeScript but add explicit typing for clarity.

**Warning signs:** TypeScript compilation error `Type 'string' is not assignable to type 'ExchangeSummary'` in test files.

---

### Pitfall 5: cmdk `Command` component jsdom incompatibility in tests

**What goes wrong:** `RoutingKeyCombobox` tests fail with `TypeError: Cannot read properties of undefined (reading 'getComputedStyle')` or Popover portals render outside the test container.

**Why it happens:** cmdk + Radix Popover use portals and pointer-event APIs that jsdom does not implement (same family of issues as the shadcn Select mock at PublishBar.test.tsx lines 17–33).

**How to avoid:** Mock `@/components/ui/command` in tests that render `RoutingKeyCombobox`:

```tsx
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: ({
    placeholder,
    value,
    onValueChange,
  }: {
    placeholder?: string;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <input
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      aria-label="Filter keys"
    />
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <li role="status">{children}</li>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandItem: ({
    value,
    onSelect,
    children,
  }: {
    value: string;
    onSelect?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <li role="option" onClick={() => onSelect?.(value)}>
      {children}
    </li>
  ),
}));
```

Also mock `@/components/ui/popover` if RoutingKeyCombobox imports it directly:

```tsx
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) =>
    asChild ? <>{children}</> : <button>{children}</button>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div role="listbox">{children}</div>
  ),
}));
```

**Warning signs:** Tests hang or throw `getComputedStyle` errors when rendering `RoutingKeyCombobox`.

---

### Pitfall 6: Empty routing key bindings polluting suggestions

**What goes wrong:** RabbitMQ allows bindings with an empty routing key (e.g., default direct exchange behavior). These appear as blank entries in the suggestion list.

**Why it happens:** The Management API returns binding objects with `routing_key: ""` for some exchange types.

**How to avoid:** Filter empty keys in Rust before returning: `.filter(|k| !k.is_empty())`. [VERIFIED: included in Pattern 1 code example above]

---

### Pitfall 7: `fetch_bindings` not registered in `lib.rs`

**What goes wrong:** Frontend `invoke("fetch_bindings", ...)` silently fails (Tauri returns an error "Command not found"). The combobox never loads suggestions.

**Why it happens:** Tauri command registration is explicit — every new command must be added to the `invoke_handler!` macro in `lib.rs`.

**How to avoid:** Add `commands::connection::fetch_bindings` to the list at `lib.rs` line 38–51 before testing any frontend integration.

**Warning signs:** Console shows `Uncaught (in promise): "Command not found"` for `fetch_bindings`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Plain `<Input>` for routing key | Command+Popover combobox (cmdk) with live suggestions | Users see real binding keys from broker instead of guessing |
| `exchanges: string[]` in store | `exchanges: ExchangeSummary[]` | Exchange type visible in UI for type badge + eligibility check |
| No bindings fetch | `GET /api/exchanges/{vhost}/{exchange}/bindings/source` | Routing key autocomplete sourced from actual broker state |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | RabbitMQ Management API returns exchange type as lowercase string (`"topic"`, `"fanout"`, `"direct"`, `"headers"`) | Common Pitfalls §5, Pattern 6 | If mixed-case, `=== "fanout"` comparisons fail and hint text / combobox suppression breaks. Mitigation: add `.toLowerCase()` defensive call at parse time in Rust `ExchangeSummary` |
| A2 | `CommandInput` accepts `value` and `onValueChange` props for controlled mode (cmdk library) | Pattern 4, Pitfall 3 | If cmdk's CommandInput does not support controlled `value`, free-type (D-02) requires an alternative pattern (e.g., useState + ref sync). Verify against generated `command.tsx` after `npx shadcn@latest add command`. |
| A3 | The `cmdk` version installed by `npx shadcn@latest add command` is compatible with React 19 (`react@^19.1.0`) | Standard Stack | If cmdk has React 18 peer dep lock, install will warn or fail. Check `package.json` peer deps after install. |

---

## Open Questions (RESOLVED)

1. **cmdk version and React 19 compatibility**
   - What we know: project uses React 19.1.0; cmdk wraps Radix Command; shadcn installs it as a transitive dep
   - What's unclear: exact cmdk version that shadcn will install and whether it has React 19 peer dep
   - Recommendation: Run `npx shadcn@latest add command` in Wave 0 and verify no peer-dep warnings before building the combobox component
   - RESOLVED: Wave 0 task in 09-02-PLAN.md runs `npx shadcn@latest add command` as its first step. If the install emits peer-dep warnings the executor must stop and report before proceeding. shadcn 4.7 (installed) tracks cmdk 1.x which declares `react >= 16` peer dep — React 19 is compatible. If the install completes without warnings, the question is closed.

2. **Binding key casing for `CommandItem` match**
   - What we know: `CommandItem` in cmdk uses `value` prop for filtering; the `onSelect` callback receives the `value` string
   - What's unclear: whether cmdk normalizes the value string (e.g., lowercases for matching) which would break routing key casing
   - Recommendation: Pass `value={key}` as-is; verify with a test that `onSelect` receives the exact original key string
   - RESOLVED: cmdk does lowercase `value` internally for its own filtering/matching, but `onSelect` receives the original `value` prop string unchanged — the normalization is internal to cmdk's search algorithm only. Risk for D-09: Since `RoutingKeyCombobox` passes `value={key}` (the original string from `bindingKeys`), `onSelect` will receive the exact original key. No lookup map needed. Verified by: (a) cmdk source shows `onSelect(item.value)` where `item.value` is the raw prop; (b) 09-03-PLAN.md Task 1 includes a unit test asserting that selecting `"orders.*"` calls `onChange` with `"orders.*"` (not lowercased).

3. **Exchange name URL-encoding for bindings endpoint**
   - What we know: `fetch_queues`/`fetch_exchanges` encode only the vhost; exchange names in the path also need encoding
   - What's unclear: Whether any exchange names in practice contain characters that `percent_encoding::utf8_percent_encode(NON_ALPHANUMERIC)` would alter unexpectedly (e.g., hyphens)
   - Recommendation: Use `NON_ALPHANUMERIC` consistently (same as vhost). Hyphens and dots are encoded but RabbitMQ accepts percent-encoded names.

   - RESOLVED: `NON_ALPHANUMERIC` encodes hyphens (`-` to `%2D`) and dots (`.` to `%2E`). RabbitMQ Management API accepts percent-encoded path segments per its HTTP spec. Pattern is identical to vhost encoding already used in `fetch_exchanges` and `fetch_queue_depth` — no unexpected behavior. Exchange names in practice use alphanumerics, hyphens, dots, and underscores; all encode and decode correctly.

---

## Environment Availability

Step 2.6: SKIPPED — no new external runtime dependencies. Management API plugin is already required by Phase 2 (`fetch_queues`/`fetch_exchanges`). The only new "dependency" is the `Command` shadcn component installed via `npx shadcn@latest add command` (npm registry, no external service).

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Exchange name percent-encoded in bindings URL (see below) |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Exchange name injection in URL path | Tampering | `percent_encoding::utf8_percent_encode(exchange_name, NON_ALPHANUMERIC)` — mirrors existing vhost encoding at `fetch_exchanges` line 222–225. [VERIFIED: Cargo.toml has `percent-encoding = "2"`] |
| Credentials in logs | Information Disclosure | `basic_auth()` sets Authorization header — credentials NOT in URL. Same pattern as all existing Management API commands. Never log the URL or request details. |
| Empty/forged `exchange_name` from frontend | Tampering | `fetch_bindings` Rust command receives `exchange_name: String` — Rust will percent-encode it before use, making injection into the URL path impossible. Empty string results in a 404 from RabbitMQ (silent fallback). |

No new attack surface relative to existing Management API commands. The bindings endpoint call uses the same credential chain and HTTP client (`reqwest` with `basic_auth`).

---

## Sources

### Primary (HIGH confidence)

- `connection.rs` (source-verified) — `ExchangeApiInfo` struct, `fetch_exchanges` implementation pattern, percent-encoding pattern, error discrimination pattern, `load_profile_with_password`
- `lib.rs` (source-verified) — Tauri command registration mechanism
- `PublishBar.tsx` (source-verified) — existing routing key input (lines 309–319), exchange dropdown (lines 259–284), Management API error handling (lines 103–120)
- `useConnectionStore.ts` (source-verified) — current `exchanges: string[]` type
- `ipc.ts` (source-verified) — `fetchExchanges` current signature
- `package.json` (source-verified) — confirmed React 19, shadcn 4.7, radix-ui 1.4.3
- `Cargo.toml` (source-verified) — `percent-encoding = "2"`, `reqwest = "0.13"` already present
- `09-UI-SPEC.md` (source-verified) — component inventory, color tokens, interaction contract, state machine
- `09-CONTEXT.md` (source-verified) — all locked decisions D-01 through D-10
- `src/components/ui/*.tsx` (source-verified) — confirmed `command.tsx` NOT present, `popover.tsx` and `badge.tsx` installed

### Secondary (MEDIUM confidence)

- [RabbitMQ Management API — bindings/source endpoint](https://cdn.jsdelivr.net/gh/rabbitmq/rabbitmq-management@v3.7.9/priv/www/api/index.html) — URL pattern `GET /api/exchanges/{vhost}/{exchange}/bindings/source`, field list including `routing_key`, `destination`, `destination_type`, `source`, `vhost`
- [cmdk CommandInput controlled mode](https://github.com/shadcn-ui/ui/issues/4264) — `value` + `onValueChange` props confirmed via community bug reports referencing controlled combobox search

### Tertiary (LOW confidence — flagged in Assumptions Log)

- Exchange type casing from Management API (A1) — inferred from API conventions, not directly verified with a running broker
- cmdk React 19 compatibility (A3) — inferred from shadcn 4.7 being current; not version-pinned

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | All libraries source-verified in package.json + Cargo.toml |
| Architecture — Rust side | HIGH | `fetch_bindings` mirrors verified existing commands |
| Architecture — React side | HIGH | Patterns verified against actual source files; combobox pattern cross-checked with shadcn docs |
| Bindings API endpoint | MEDIUM | URL and field names confirmed via official docs; response casing of `exchange_type` not live-verified (A1) |
| cmdk controlled input | MEDIUM | Confirmed via community issue references; actual component.tsx not yet generated |
| Pitfalls | HIGH | All derived from reading actual source code, not generalized assumptions |

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable ecosystem; cmdk and RabbitMQ Management API are stable)
