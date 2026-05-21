# Example Proto Files

Open these in Proto Sender to test different field types. Each file is self-contained except `event.proto` (well-known type imports) and the `multi-file/` example (cross-file imports).

| File | What it tests |
|------|---------------|
| `user.proto` | Scalar fields, enum, repeated strings, multiple message types in one file |
| `order.proto` | Nested messages, repeated messages, oneof (credit card / bank transfer / voucher), enum |
| `sensor.proto` | int64/uint64 (text input), float, double, bytes, fixed32, sfixed64, repeated nested |
| `event.proto` | `google.protobuf.Timestamp`, `Duration`, `StringValue` (well-known types) — requires include path |
| `multi-file/checkout/checkout.proto` | Cross-package imports, two levels of dependency, include path configuration |

## Loading event.proto

`event.proto` imports from `google/protobuf/`. You need to add the directory that contains the `google/` folder as an include path in Proto Sender:

- **macOS (via Homebrew):** `/opt/homebrew/include` or `/usr/local/include`
- **Linux:** `/usr/include`
- **From protoc download:** the `include/` directory inside the protoc archive

If you don't have the well-known type protos installed, use the other three files — they have no imports.

## Loading multi-file/checkout/checkout.proto

This example has two levels of import depth:

```
checkout/checkout.proto
  ├── catalog/product.proto
  │     └── common/money.proto
  ├── common/address.proto
  └── common/money.proto
```

To load it in Proto Sender:

1. **Add include path:** the `multi-file/` directory (e.g. `/path/to/examples/multi-file`)
2. **Open file:** `multi-file/checkout/checkout.proto`

The include path must point to the root of the `multi-file/` tree so that import paths like `"catalog/product.proto"` and `"common/money.proto"` resolve correctly. Opening the file without the include path will fail with an import resolution error.

## Multi-file tab testing

Open `user.proto` and `order.proto` at the same time to test tab switching. Each tab maintains its own selected message type and form state independently.
