FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/umutungo-api ./cmd/server

FROM alpine:3.22
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /app/storage/media && chown -R app:app /app/storage
COPY --from=build /out/umutungo-api /app/umutungo-api
COPY --from=build /src/migrations /app/migrations
USER app
EXPOSE 8080
ENTRYPOINT ["/app/umutungo-api"]
