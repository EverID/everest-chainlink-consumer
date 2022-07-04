FROM golang:1.17 as builder

WORKDIR /go/src/adapter

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /usr/local/bin/adapter adapter

FROM alpine:3.9

COPY --from=builder /usr/local/bin/adapter /usr/local/bin/adapter

RUN apk add --no-cache ca-certificates

EXPOSE 8085

ENTRYPOINT ["adapter"]
