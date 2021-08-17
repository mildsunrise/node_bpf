#!/bin/bash
set -eEuo pipefail
cd "$(dirname "$0")/../.."

VERSION="$1"

if [ ! -z "$(git status --porcelain)" ]; then
  echo "error: working directory must be clean"; exit 1
fi

cd deps

rm -rf elfutils; mkdir elfutils

URL="https://sourceware.org/elfutils/ftp/$VERSION/elfutils-$VERSION.tar.bz2"
ORIG="elfutils-$VERSION"
curl -fL "$URL" | tar -xj "$ORIG"
( cd "$ORIG";
  # code (only libelf and common lib)
  mv lib libelf version.h ../elfutils/
  # license
  mv COPYING* ../elfutils/
  # config template
  mv config.h.in ../elfutils/
)
rm -rf "$ORIG"

# patches
rm elfutils/lib/{color,printversion}.{h,c}

if [ -z "$(git status --porcelain)" ]; then
  echo "error: no changes"; exit 1
fi

git add -A; git commit -m "deps: upgrade elfutils $VERSION"
echo -e '\ndone. do the following manual steps and amend the commit:'
echo ' - update versions["libelf"] in src/binding.cc'
echo ' - review `git show -- deps/elfutils/config.in.h` and update elfutils_config/config.h'
echo ' - review buildsystem changes (new files, deps)'
