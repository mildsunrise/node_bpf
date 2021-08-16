#!/bin/bash
set -eEuo pipefail
cd "$(dirname "$0")/../.."

VERSION="$1"

if [ ! -z "$(git status --porcelain)" ]; then
  echo "error: working directory must be clean"; exit 1
fi

cd deps

rm -rf libbpf

URL="https://github.com/libbpf/libbpf/archive/refs/tags/v$VERSION.tar.gz"
ORIG="libbpf-$VERSION"
curl -fL "$URL" | tar -xz "$ORIG"
mv "$ORIG" libbpf
rm -r libbpf/travis-ci

if [ -z "$(git status --porcelain)" ]; then
  echo "error: no changes"; exit 1
fi

git add -A; git commit -m "deps: upgrade libbpf $VERSION"
echo -e '\ndone. do the following manual steps and amend the commit:'
echo ' - update versions["libbpf"] in src/binding.cc'
echo ' - review `git show -- deps/libbpf/include/uapi/linux/bpf.h` and update lib/constants.ts'
echo ' - review `git show -- deps/libbpf/src/libbpf.h` and update lib/exception.ts'
echo ' - review buildsystem changes'
