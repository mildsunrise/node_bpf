#!/bin/bash
set -e

node -e 'p = `./prebuilds/${process.platform}-${process.arch}/node.napi.node`; require(p); console.log(`Successfully loaded: ${p}`)'
