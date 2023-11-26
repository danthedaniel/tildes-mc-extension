#!/bin/bash

# Add all files in src/* to a zip called extension.xpi.
cd "$(dirname "$0")"/src
zip -r ../extension.xpi *
