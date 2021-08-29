#!/bin/bash
set -e

NODE_VERSION="$1"

apt-get -qq update
apt-get -qq install -y curl python3 build-essential

if [ "$(uname -m)" = "x86_64" ]; then
    # needed to build for i386
    apt-get -qq install -y gcc-multilib g++-multilib
fi

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

exec "${@:2}"
