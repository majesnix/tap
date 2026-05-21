# Phase 9: Routing Key Autocomplete — Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 7 (new/modified)
**Analogs found:** 6 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/connection.rs` | service | request-response | `src-tauri/src/commands/connection.rs` `fetch_queue_depth` (lines 266–313) | exact — two-param, two-encoded-segment Management API command |
| `src-tauri/src/lib.rs` | config | — | `src-tauri/src/lib.rs` (lines 38–51) | exact — same invoke_handler registration list |
| `src/lib/types.ts` | model | — | `src/lib/types.ts` `ConnectionProfile` interface (lines 69–77) | exact — snake_case field interface in the same file |
| `src/lib/ipc.ts` | utility | request-response | `src/lib/ipc.ts` `fetchQueueDepth` (lines 51–56) | exact — two-param IPC wrapper |
| `src/stores/useConnectionStore.ts` | store | — | `src/stores/useConnectionStore.ts` (lines 1–47) | exact — same store file being extended |
| `src/components/publish/PublishBar.tsx` | component | request-response | `src/components/response/ResponseQueuePicker.tsx` (lines 44–90) for the new useEffect; `src/components/publish/PublishBar.tsx` (lines 259–306) for Select/badge render | role-match (cancellable-fetch useEffect) + exact (badge/conditional render) |
| `src/components/publish/RoutingKeyCombobox.tsx` | component | request-response | **No analog** — cmdk Command component not yet installed | none — use RESEARCH.md Pattern 4 |

---

## Pattern Assignments

### `src-tauri/src/commands/connection.rs` — two changes

#### Change A: New `fetch_bindings` command

**Analog:** `fetch_queue_depth` in `connection.rs` (lines 266–313)

This is the only existing command that:
- Takes two string parameters (`profile_name`, `queue_name` — parallel to `profile_name`, `exchange_name`)
- Percent-encodes BOTH the vhost AND a named resource using `NON_ALPHANUMERIC`
- Constructs a two-segment resource URL (`/api/queues/{vhost}/{queue}`)
- Uses the standard `load_profile_with_password` + `Client::new()` + `basic_auth` chain

**Imports pattern** (lines 1–11 — already present, no changes needed):
```rust
use reqwest::Client;
use serde::Deserialize;
use tauri::AppHandle;
use crate::error::AppError;
use crate::profiles::...;
```

**Two-parameter Management API command pattern** (lines 266–313 — copy for `fetch_bindings`):
```rust
// fetch_queue_depth — analog for fetch_bindings shape
#[tauri::command]
pub async fn fetch_queue_depth(
    app: AppHandle,
    profile_name: String,
    queue_name: String,                   // ← second param; becomes exchange_name
) -> Result<u64, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let encoded_queue = percent_encoding::utf8_percent_encode(   // ← encode the resource name too
        &queue_name,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/queues/{}/{}",                           // ← two-segment path
        scheme, profile.host, profile.management_port, encoded_vhost, encoded_queue
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
        200 => { /* deserialize + transform */ }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}
```

**Dedup + filter pattern** (unique to `fetch_bindings` — no analog; use directly):
```rust
// Inside the 200 branch of fetch_bindings:
let mut keys: Vec<String> = bindings
    .into_iter()
    .map(|b| b.routing_key)
    .filter(|k| !k.is_empty())   // exclude default-exchange empty-key bindings
    .collect();
keys.sort();
keys.dedup();    // sort MUST precede dedup in Rust
Ok(keys)
```

**Deserialize struct pattern** (lines 16–19 — same as `QueueApiInfo`):
```rust
#[derive(Deserialize)]
struct QueueApiInfo {
    name: String,
}
// Copy for BindingApiInfo:
#[derive(Deserialize)]
struct BindingApiInfo {
    routing_key: String,
}
```

---

#### Change B: `fetch_exchanges` return type — `Vec<String>` → `Vec<ExchangeSummary>`

**Analog:** `ExchangeApiInfo` struct definition (lines 28–36) + `fetch_exchanges` map chain (lines 356–360)

**Existing struct** (lines 28–36 — `exchange_type` already captured but dead):
```rust
#[derive(Deserialize)]
struct ExchangeApiInfo {
    name: String,
    #[allow(dead_code)]          // ← remove this attribute
    #[serde(rename = "type")]
    exchange_type: String,
    internal: bool,
}
```

**Add new serializable output struct** (insert after line 36):
```rust
use serde::Serialize;  // already in scope via serde::Deserialize; add Serialize

#[derive(Serialize)]
pub struct ExchangeSummary {
    pub name: String,
    pub exchange_type: String,  // raw from API: "direct" | "fanout" | "topic" | "headers"
}
```

**Change the map chain** (lines 357–360 — `.map(|e| e.name)` → `.map(|e| ExchangeSummary {...})`):
```rust
// BEFORE (line 360):
.map(|e| e.name)
// AFTER:
.map(|e| ExchangeSummary { name: e.name, exchange_type: e.exchange_type })
```

**Change return type signature** (line 323):
```rust
// BEFORE:
pub async fn fetch_exchanges(...) -> Result<Vec<String>, AppError>
// AFTER:
pub async fn fetch_exchanges(...) -> Result<Vec<ExchangeSummary>, AppError>
```

---

### `src-tauri/src/lib.rs` — register `fetch_bindings`

**Analog:** Existing `invoke_handler!` list (lines 38–51)

**Registration pattern** (lines 38–51 — add one entry):
```rust
.invoke_handler(tauri::generate_handler![
    commands::proto::parse_proto,
    commands::encode::encode_message,
    commands::connection::save_profile,
    commands::connection::list_profiles,
    commands::connection::delete_profile,
    commands::connection::test_connection,
    commands::connection::activate_profile,
    commands::connection::fetch_queues,
    commands::connection::fetch_queue_depth,
    commands::connection::fetch_exchanges,
    commands::connection::fetch_bindings,   // ← add here; omitting = silent "Command not found"
    commands::publish::publish_message,
    commands::consume::consume_message,
])
```

---

### `src/lib/types.ts` — add `ExchangeSummary` interface

**Analog:** `ConnectionProfile` interface (lines 69–77) — same file, same naming convention (snake_case fields matching Rust serialization)

**Existing interface pattern** (lines 69–77):
```typescript
export interface ConnectionProfile {
  name: string;
  host: string;
  port: number;
  vhost: string;
  username: string;
  management_port: number;   // ← snake_case matches Rust serde field names
  management_ssl: boolean;
}
```

**New interface to add** (append after `ManagementStatus` on line 80):
```typescript
// Phase 9: exchange type summary returned by updated fetch_exchanges command
export interface ExchangeSummary {
  name: string;
  exchange_type: string;   // snake_case per project convention; values: "direct" | "fanout" | "topic" | "headers"
}
```

---

### `src/lib/ipc.ts` — update `fetchExchanges`, add `fetchBindings`

**Analog:** `fetchQueueDepth` (lines 51–56) — two-parameter IPC wrapper, same file

**Existing two-param wrapper pattern** (lines 51–56):
```typescript
export async function fetchQueueDepth(
  profileName: string,
  queueName: string,
): Promise<number> {
  return invoke<number>("fetch_queue_depth", { profileName, queueName });
}
```

**Update `fetchExchanges` return type** (line 58–60):
```typescript
// BEFORE:
export async function fetchExchanges(profileName: string): Promise<string[]>
// AFTER (import ExchangeSummary from ./types):
import type { ExchangeSummary } from "./types";

export async function fetchExchanges(profileName: string): Promise<ExchangeSummary[]> {
  return invoke<ExchangeSummary[]>("fetch_exchanges", { profileName });
}
```

**New `fetchBindings` wrapper** (add after `fetchExchanges`):
```typescript
export async function fetchBindings(
  profileName: string,
  exchangeName: string,
): Promise<string[]> {
  return invoke<string[]>("fetch_bindings", { profileName, exchangeName });
}
```

---

### `src/stores/useConnectionStore.ts` — `exchanges: string[]` → `ExchangeSummary[]`

**Analog:** The store itself (lines 1–47) — same file, changing the type of one field and its setter

**Current shape** (lines 11–20):
```typescript
queues: string[];
exchanges: string[];           // ← change to ExchangeSummary[]

setQueues: (queues: string[]) => void;
setExchanges: (exchanges: string[]) => void;  // ← change to (exchanges: ExchangeSummary[]) => void
```

**INITIAL_STATE** (lines 24–33 — `exchanges: [] as string[]` → `exchanges: [] as ExchangeSummary[]`):
```typescript
const INITIAL_STATE = {
  ...
  exchanges: [] as ExchangeSummary[],  // ← update type annotation
} as const;
```

**Import to add** (top of file):
```typescript
import type { ConnectionProfile, ConnectionStatus, ManagementStatus, ExchangeSummary } from "@/lib/types";
```

**Test-seed ripple locations** — all 15 use `exchanges: []` (empty array) which satisfies both `string[]` and `ExchangeSummary[]` at runtime. TypeScript strict mode will accept them. No test content changes are strictly required, but for explicitness the planner may annotate seeds as `exchanges: [] as ExchangeSummary[]` in key files. Specific locations:

| File | Lines |
|------|-------|
| `src/components/connection/__tests__/ConnectionSection.test.tsx` | 53, 75, 175, 212 |
| `src/components/connection/__tests__/ProfileManagementModal.test.tsx` | 39, 128, 191, 249 |
| `src/components/publish/__tests__/PublishBar.test.tsx` | 66, 87, 105, 131, 154 |
| `src/components/response/ResponseQueuePicker.test.tsx` | 71 |
| `src/components/response/ResponseTab.test.tsx` | 45 |

Any test seed that populates `exchanges` with named strings (e.g., `exchanges: ["orders", "payments"]`) WILL fail TypeScript after the type change and MUST be updated to `[{ name: "orders", exchange_type: "direct" }, ...]`. None exist today — all 15 seeds are `exchanges: []`.

---

### `src/components/publish/PublishBar.tsx` — two integration changes

#### Change A: New bindings `useEffect` with stale-request cleanup

**Analog:** `ResponseQueuePicker.tsx` lines 44–70 — the ONLY existing useEffect in the project that uses the `let cancelled = false` / `return () => { cancelled = true; }` cancellable-fetch pattern.

**DO NOT copy PublishBar's own existing useEffect (lines 85–124)** — it has no cleanup and will produce the stale-request bug (RESEARCH.md Pitfall 2).

**Cancellable fetch pattern** (ResponseQueuePicker.tsx lines 44–70):
```typescript
// Queue fetch on tab focus — cancellable pattern
useEffect(() => {
  if (!activeProfileName) return;
  let cancelled = false;                         // ← stale-request guard

  const fetch = async () => {
    try {
      const qs = await fetchQueues(activeProfileName);
      if (cancelled) return;                     // ← guard before setState
      setManagementAuthError(null);
      setQueueList(qs, true);
    } catch (err: unknown) {
      if (cancelled) return;                     // ← guard in catch too
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.startsWith("Management API authentication failed")) {
        setManagementAuthError(errMsg);
        setQueueList([], false);
      } else {
        setManagementAuthError(null);
        setQueueList([], false);
      }
    }
  };
  void fetch();
  return () => {
    cancelled = true;                            // ← cleanup sets the guard
  };
}, [activeProfileName, setQueueList, setManagementAuthError]);
```

**CRITICAL difference for bindings effect:** D-10 mandates ALL bindings errors fall back silently — do NOT include any `errMsg.startsWith(...)` or `errMsg.includes(...)` auth-error check in the bindings catch block. The entire catch body is unconditionally: `setBindingKeys([])`, `setIsLoadingBindings(false)`, `setUseCombobox(false)`.

**Bindings useEffect shape** (new, follows ResponseQueuePicker cancel pattern):
```typescript
const [bindingKeys, setBindingKeys] = useState<string[]>([]);
const [isLoadingBindings, setIsLoadingBindings] = useState(false);
const [useCombobox, setUseCombobox] = useState(false);

// Derived: eligibility checks
const selectedExchangeObj = exchanges.find((ex) => ex.name === selectedExchange);
const selectedExchangeType = selectedExchangeObj?.exchange_type ?? "";
const isHintExchange = selectedExchangeType === "headers" || selectedExchangeType === "fanout";
const isEligibleForCombobox =
  !isHintExchange && managementStatus === "live" && Boolean(selectedExchange);

useEffect(() => {
  if (!activeProfileName || !isEligibleForCombobox) {
    setBindingKeys([]);
    setUseCombobox(false);
    return;
  }

  let cancelled = false;   // ← same pattern as ResponseQueuePicker
  setIsLoadingBindings(true);
  setUseCombobox(true);

  fetchBindings(activeProfileName, selectedExchange)
    .then((keys) => {
      if (!cancelled) {
        setBindingKeys(keys);
        setIsLoadingBindings(false);
      }
    })
    .catch(() => {
      // D-10: ALL errors → silent fallback. NEVER call setManagementAuthError here.
      if (!cancelled) {
        setBindingKeys([]);
        setIsLoadingBindings(false);
        setUseCombobox(false);
      }
    });

  return () => { cancelled = true; };
}, [activeProfileName, selectedExchange, isEligibleForCombobox]);
```

---

#### Change B: Exchange dropdown + routing key section render update

**Analog:** PublishBar.tsx lines 259–319 — the Select/badge/Input conditional block being replaced

**Existing conditional render pattern** (lines 259–306 — for badge style reference):
```typescript
{managementAuthError ? (
  <Badge variant="destructive" className="text-xs">
    {managementAuthError}
  </Badge>
) : managementStatus === "live" ? (
  <Badge variant="outline" className="text-xs gap-1">
    <span className="w-2 h-2 rounded-full bg-emerald-500" />
    Live
  </Badge>
) : (
  <Badge variant="outline" className="text-xs gap-1">
    <span className="w-2 h-2 rounded-full bg-amber-500" />
    Manual
  </Badge>
)}
```

**Exchange SelectItem pattern** (lines 270–274 — extend for type badge in D-05):
```typescript
// BEFORE: string[] mapped directly
{(mode === "queue" ? queues : exchanges).map((name) => (
  <SelectItem key={name} value={name}>{name}</SelectItem>
))}
// AFTER: ExchangeSummary[] with type badge (exchange mode only)
{mode === "exchange"
  ? exchanges.map((ex) => (
      <SelectItem key={ex.name} value={ex.name}>
        <span className="flex items-center gap-2">
          {ex.name}
          <Badge variant="outline" className="text-xs text-muted-foreground font-semibold">
            [{ex.exchange_type}]
          </Badge>
        </span>
      </SelectItem>
    ))
  : queues.map((name) => (
      <SelectItem key={name} value={name}>{name}</SelectItem>
    ))}
```

**Routing key section** (lines 309–319 — replace entirely):
```typescript
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

---

### `src/components/publish/__tests__/PublishBar.test.tsx` — test updates

**Analog:** PublishBar.test.tsx lines 16–33 — shadcn Select mock pattern (native element substitute for Radix portal components)

**Existing Select mock pattern** (lines 16–33 — copy convention for Command and Popover mocks):
```typescript
// Dodge Radix UI portal/pointer-event jsdom incompatibility with native substitutes
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) => (
    <select
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
      role="combobox"
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));
```

**Apply same convention** for `@/components/ui/command` and `@/components/ui/popover` in both PublishBar.test.tsx updates and new RoutingKeyCombobox.test.tsx. See RESEARCH.md Pitfall 5 for the concrete mock shapes to use.

**Store seed update** — all existing `exchanges: []` seeds (15 locations listed in the store section above) are compatible with `ExchangeSummary[]`. No changes required unless a test adds named-string exchanges, which none currently do.

**New test scenarios to add** for bindings useEffect and combobox:
- `invoke("fetch_bindings")` called when eligible exchange is selected
- `invoke("fetch_bindings")` NOT called for fanout/headers exchange types
- `setBindingKeys([])` + combobox hides on fetch_bindings error (D-10 fallback)
- Stale-request: rapid exchange switch cancels first fetch (cancelled flag)

---

### `src/components/publish/RoutingKeyCombobox.tsx` — new component

**No analog found.** The project has no existing cmdk Command component. This file should be built following RESEARCH.md Pattern 4 exclusively.

**Key props interface** (derive from RESEARCH.md Pattern 4):
```typescript
interface RoutingKeyComboboxProps {
  value: string;
  onChange: (value: string) => void;
  bindingKeys: string[];
  isLoading: boolean;
}
```

**Critical deviation from canonical shadcn combobox:** `CommandInput` MUST be controlled: `value={value}` + `onValueChange={onChange}`. Without this, typing does not update `routingKey` state (D-02 free-type fails). See RESEARCH.md Pitfall 3.

**Wildcard detection** (pure utility, no analog needed):
```typescript
const isWildcard = (key: string): boolean => key.includes("*") || key.includes("#");
```

**Amber pattern badge** (see Badge component `badge.tsx` lines 1–49 — use `className` override on the default variant):
```typescript
<Badge className="ml-2 bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 font-semibold shrink-0">
  pattern
</Badge>
```

**Command/Popover import style** (mirrors popover.tsx lines 1–2 and badge.tsx lines 1–4 — shadcn path alias convention):
```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

---

## Shared Patterns

### Cancellable async useEffect
**Source:** `src/components/response/ResponseQueuePicker.tsx` lines 44–70  
**Apply to:** New bindings useEffect in PublishBar.tsx  
**CRITICAL:** Do NOT use the existing PublishBar useEffect (lines 85–124) as the pattern — it has no cleanup.

```typescript
let cancelled = false;
void (async () => {
  try {
    const result = await someIpcCall(...);
    if (cancelled) return;
    setData(result);
  } catch {
    if (cancelled) return;
    setData(fallback);
  }
})();
return () => { cancelled = true; };
```

---

### Management API error discrimination
**Source:** `src/components/publish/PublishBar.tsx` lines 103–119 (substring match) and `src/components/response/ResponseQueuePicker.tsx` lines 56–64 (startsWith match)  
**Apply to:** `fetch_exchanges`/`fetch_queues` effects only — NOT to the new bindings effect  
**For bindings (D-10):** The catch block is unconditional silence — no auth-error branch, no substring check.

```typescript
// PublishBar pattern (fetch_exchanges / fetch_queues):
if (errMsg.includes("authentication failed")) {
  setManagementAuthError(errMsg);
} else {
  setManagementAuthError(null);
  setManagementStatus("manual");
}

// Bindings effect — DO NOT copy the above. Use instead:
catch () {
  // D-10: ALL bindings errors → silent fallback, no error surface
  setBindingKeys([]);
  setIsLoadingBindings(false);
  setUseCombobox(false);
}
```

---

### shadcn Radix mock for jsdom tests
**Source:** `src/components/publish/__tests__/PublishBar.test.tsx` lines 16–33  
**Apply to:** Any test file that renders RoutingKeyCombobox, and updated PublishBar tests that exercise the combobox path  
**Pattern:** Replace Radix portal components with native HTML substitutes that jsdom can handle.

---

### AppError variant serialization
**Source:** `src-tauri/src/error.rs` lines 1–37  
**Apply to:** `fetch_bindings` — uses existing `AppError` variants, no new variants needed  
**Note:** `ManagementApiAuthFailed` serializes to the exact string matched by frontend substring checks. For bindings, this error variant is still returned from Rust but caught silently in the frontend.

---

### Tauri command `#[tauri::command]` + `async fn` shape
**Source:** `src-tauri/src/commands/connection.rs` lines 215–259 (`fetch_queues`) or lines 266–313 (`fetch_queue_depth`)  
**Apply to:** `fetch_bindings` — same decorator, same async signature, same `AppHandle` first param

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/publish/RoutingKeyCombobox.tsx` | component | request-response | No cmdk Command component exists in project; `command.tsx` must be generated via `npx shadcn@latest add command` before this file can be written |
| `src/components/ui/command.tsx` | ui | — | Auto-generated by `npx shadcn@latest add command`; do not hand-write; install before Wave 2 |

---

## Metadata

**Analog search scope:** `src/` (TypeScript), `src-tauri/src/` (Rust)  
**Files scanned:** 12 TypeScript files, 7 Rust files  
**Pattern extraction date:** 2026-05-19

**Key constraints not to miss:**
1. `fetch_bindings` registration in `lib.rs` is mandatory — Tauri silently ignores unregistered commands
2. `CommandInput` must be controlled (`value` + `onValueChange`) — canonical shadcn demo is uncontrolled
3. Bindings catch block must NOT call `setManagementAuthError` — D-10 is unconditional silence
4. All 15 `exchanges: []` test seeds are safe (empty array satisfies `ExchangeSummary[]`) — no content changes needed, only type annotation updates if desired
