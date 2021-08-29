#!/bin/bash
set -e

ARCHS="$1"
for arch in $ARCHS; do
    npm run prebuildify -- --napi --platform=linux --arch=$arch
done
chown "$(stat -c%u /app):$(stat -c%g /app)" -R prebuilds
cp -a prebuilds /app
