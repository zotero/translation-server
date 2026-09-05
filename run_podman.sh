#!/usr/bin/env bash
set -e

# Select container tool (prefer podman, fallback to docker)
if command -v podman &>/dev/null; then
    CONTAINER_TOOL="podman"
elif command -v docker &>/dev/null; then
    CONTAINER_TOOL="docker"
else
    echo "Error: Neither podman nor docker was found in PATH." >&2
    exit 1
fi

IMAGE_NAME="translation-server:amd64"
CONTAINER_NAME="translation-server"
PORT=1969

echo "=== Using container tool: ${CONTAINER_TOOL} ==="

# Stop and remove existing container if running in podman or docker
echo "-> Cleaning up any existing containers on port ${PORT}..."
podman stop "${CONTAINER_NAME}" &>/dev/null || true
podman rm "${CONTAINER_NAME}" &>/dev/null || true
docker stop "${CONTAINER_NAME}" &>/dev/null || true
docker rm "${CONTAINER_NAME}" &>/dev/null || true


# Build the amd64 image
echo "-> Building image '${IMAGE_NAME}' for amd64..."
${CONTAINER_TOOL} build --platform linux/amd64 -t "${IMAGE_NAME}" .

# Start the container
echo "-> Starting container '${CONTAINER_NAME}' on port ${PORT}..."
${CONTAINER_TOOL} run -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT}:${PORT}" \
  "${IMAGE_NAME}"

# Wait for server readiness
echo "-> Waiting for translation-server to initialize..."
MAX_ATTEMPTS=30
ATTEMPT=0
READY=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -d "10.1038/nature12373" -H "Content-Type: text/plain" "http://127.0.0.1:${PORT}/search" | grep -q "journalArticle"; then
        READY=1
        break
    fi
    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

if [ $READY -eq 1 ]; then
    echo "=================================================="
    echo " SUCCESS: translation-server is running on port ${PORT}!"
    echo "=================================================="
    echo "Test with:"
    echo "  curl -d '10.1038/nature12373' -H 'Content-Type: text/plain' http://127.0.0.1:${PORT}/search"
    echo "View logs with:"
    echo "  ${CONTAINER_TOOL} logs -f ${CONTAINER_NAME}"
    echo "Stop with:"
    echo "  ${CONTAINER_TOOL} stop ${CONTAINER_NAME}"
else
    echo "Error: Server failed to respond within 30 seconds." >&2
    echo "Container logs:"
    ${CONTAINER_TOOL} logs "${CONTAINER_NAME}"
    exit 1
fi

