#!/bin/bash
set -e

DIR="/tmp/app"
mkdir "$DIR"

# git archive HEAD | tar xC "$DIR"
cp -r . /tmp/app
rm -r /tmp/app/node_modules

cd "$DIR"

npm ci
exec "$@"
