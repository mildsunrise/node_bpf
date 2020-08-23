#!/bin/bash
set -e

ARCHS="$1"
for arch in $ARCHS; do
    npm run prebuildify -- --napi --platform=linux --arch=$arch
done
cp -r prebuilds /app
