# syntax=docker/dockerfile:1
#
# Builds a fully static musl binary — no glibc dependency, runs on any Linux.
#
# Stages:
#   1. builder  — compile against musl libc (rust:alpine toolchain)
#   2. runtime  — copy binary into a minimal alpine image

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM rust:1-alpine AS builder

# musl-dev provides the musl C headers required by some crates (lapin/openssl-sys path).
RUN apk add --no-cache musl-dev

WORKDIR /app

# Layer-cache dependencies: build a stub binary so all crate downloads and
# compilations are cached in a separate layer. Only rebuilt when Cargo.toml /
# Cargo.lock changes.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release \
    && rm -rf src

# Build the real binary. Touch main.rs so cargo sees the change vs. the stub.
COPY src ./src
RUN touch src/main.rs \
    && cargo build --release --bin echo-service

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM alpine:3

# ca-certificates: needed if the broker uses TLS.
RUN apk add --no-cache ca-certificates \
    && adduser -D -S echo

COPY --from=builder /app/target/release/echo-service /usr/local/bin/echo-service

USER echo

ENV AMQP_URL=amqp://dev:dev@rabbitmq:5672 \
    SOURCE_QUEUE=test-queue \
    REPLY_QUEUE=test-queue.reply \
    POLL_MS=200 \
    RETRY_SECS=5

CMD ["echo-service"]
