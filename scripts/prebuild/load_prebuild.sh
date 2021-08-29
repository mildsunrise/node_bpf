#!/bin/bash
set -eEuo pipefail

node -e 'p = `./prebuilds/${process.platform}-${process.arch}/node.napi.node`; require(p); console.log(`Successfully loaded: ${p}`)'
