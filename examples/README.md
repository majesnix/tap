# Example Proto Files

Open these in Proto Sender to test different field types. Each file is self-contained except `event.proto`, which imports well-known types.

| File | What it tests |
|------|---------------|
| `user.proto` | Scalar fields, enum, repeated strings, multiple message types in one file |
| `order.proto` | Nested messages, repeated messages, oneof (credit card / bank transfer / voucher), enum |
| `sensor.proto` | int64/uint64 (text input), float, double, bytes, fixed32, sfixed64, repeated nested |
| `event.proto` | `google.protobuf.Timestamp`, `Duration`, `StringValue` (well-known types) — requires include path |

## Loading event.proto

`event.proto` imports from `google/protobuf/`. You need to add the directory that contains the `google/` folder as an include path in Proto Sender:

- **macOS (via Homebrew):** `/opt/homebrew/include` or `/usr/local/include`
- **Linux:** `/usr/include`
- **From protoc download:** the `include/` directory inside the protoc archive

If you don't have the well-known type protos installed, use the other three files — they have no imports.

## Multi-file tab testing

Open `user.proto` and `order.proto` at the same time to test tab switching. Each tab maintains its own selected message type and form state independently.
