#!/bin/bash

# Add all files in src/* to a zip called extension.xpi.
cd "$(dirname "$0")"/src
mkdir -p ../out

cp ../manifests/v2.json ./manifest.json
zip -r ../out/extension.xpi *

cp ../manifests/v3.json ./manifest.json
zip -r ../out/extension.zip *

rm ./manifest.json
