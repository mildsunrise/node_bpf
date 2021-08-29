#!/bin/bash
# Re-builds prebuilds and/or tests them for portability
# Dependencies: docker (plus permissions to use it)
set -e

# Register binfmt handlers so we can emulate other archs
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Prebuild inside an older distro to target glibc 2.23
# It's from 2016 so should be enough for most people
IMAGE="ubuntu:xenial"

rm -rf prebuilds

# It only makes sense to prebuild for archs supported by
# libbpf: see deps/libbpf/src/bpf.c

scripts/prebuild/run_in_docker.sh $IMAGE 14 \
    scripts/prebuild/with_copy.sh \
    scripts/prebuild/do_prebuild.sh "ia32 x64"

scripts/prebuild/run_in_docker.sh arm32v7/$IMAGE 14 \
    scripts/prebuild/with_copy.sh \
    scripts/prebuild/do_prebuild.sh "arm"

scripts/prebuild/run_in_docker.sh arm64v8/$IMAGE 14 \
    scripts/prebuild/with_copy.sh \
    scripts/prebuild/do_prebuild.sh "arm64"

# Test that they load correctly
# (since we are just testing for Node.js / glibc,
# compatibility, I don't think it's useful to test
# more than one arch here?)
scripts/prebuild/run_in_docker.sh ubuntu:xenial 12 scripts/prebuild/load_prebuild.sh
scripts/prebuild/load_prebuild.sh
