# Thin wrapper around the official Zero cache image.
# Mount persistent storage at /data in the platform (see docs/deployment/docker.md).
# Keep this tag in sync with @rocicorp/zero in package.json.
FROM rocicorp/zero:1.6.2

ENV ZERO_REPLICA_FILE=/data/replica.db \
    ZERO_LOG_LEVEL=info \
    ZERO_ENABLE_CRUD_MUTATIONS=false \
    ZERO_APP_ID=zentro

EXPOSE 4848

HEALTHCHECK --interval=30s --timeout=10s --start-period=600s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:4848/keepalive || exit 1
