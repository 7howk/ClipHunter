# MinIO Community no longer publishes public images. Build its pinned source release.
FROM golang:1.26-bookworm AS builder
ENV CGO_ENABLED=0
RUN go install -trimpath -ldflags="-s -w" github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10002 minio \
    && useradd --uid 10002 --gid minio --no-create-home minio \
    && mkdir /data \
    && chown minio:minio /data
COPY --from=builder /go/bin/minio /usr/local/bin/minio
USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
