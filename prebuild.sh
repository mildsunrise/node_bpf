#!/bin/bash
set -e

# It only makes sense to prebuild for archs supported by
# libbpf: see deps/libbpf/src/bpf.c
rm -rf prebuilds
for arch in ia32 x64; do
    prebuildify --napi --platform=linux --arch=$arch
done
