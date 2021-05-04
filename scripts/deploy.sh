#!/usr/bin/env bash

ENV=$1

# Exit immediately if a command exits with a non-zero status.
set -e

rm -rf deployed/$ENV
cp .env.$ENV .env

npm run compile
npx hardhat run migrations/deploy_all.js --network $ENV

mkdir -p deployed/$ENV
cp -r artifacts deployed/$ENV/abi
cat .contract-deployment.tmp.json | jq '.' > deployed/$ENV/addresses.json
rm -rf .contract-deployment.tmp.json

# Copy ABIs to other razor apps repos locally (only works if they exists in parent directory)
# This is a temporary solution, its subject to change (Refs - https://github.com/razor-network/contracts/issues/35)
find ./artifacts/contracts artifacts/@openzeppelin  -type f | grep -i -v .dbg.json$ |  xargs -i cp {} ../cli/build/contracts 2>/dev/null
find ./artifacts/contracts artifacts/@openzeppelin  -type f | grep -i -v .dbg.json$ |  xargs -i cp {} ../dashboard/build/contracts 2>/dev/null
find ./artifacts/contracts artifacts/@openzeppelin  -type f | grep -i -v .dbg.json$ |  xargs -i cp {} ../bridge/build/contracts 2>/dev/null
find ./artifacts/contracts artifacts/@openzeppelin  -type f | grep -i -v .dbg.json$ |  xargs -i cp {} ../synthetic-assets/build/contracts 2>/dev/null

echo "Done"
