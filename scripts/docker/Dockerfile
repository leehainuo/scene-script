# docker/Dockerfile
# Stage 1: Build
FROM golang:1.25-alpine AS builder

WORKDIR /build

# Install dependencies
# --no-cache: Do not cache indexes to reduce image size.
RUN apk add --no-cache \
    git \
    ca-certificates \
    tzdata

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary with optimization flags
# -trimpath: Remove file system paths from binary (security).
# -ldflags="-w -s": Strip debug info and symbol table.
# -buildvcs=false: Disable VCS stamping (faster build).
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-w -s" -buildvcs=false \
    -o /app/server cmd/main.go

# Stage 2: Runtime
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    wget

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/server .

# Copy default config files
COPY --from=builder /build/config/*.yaml ./config/

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:8000/ping || exit 1

CMD ["./server"]
