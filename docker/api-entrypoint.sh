#!/bin/sh
set -e
exec node --enable-source-maps ./dist/index.mjs
