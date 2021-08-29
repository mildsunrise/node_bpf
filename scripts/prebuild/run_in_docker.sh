#!/bin/bash
set -e

IMAGE="$1"
NODE_VERSION="$2"

docker run --rm -v "$(pwd)":/app -w /app "$IMAGE" scripts/prebuild/with_node.sh "$NODE_VERSION" "${@:3}"
