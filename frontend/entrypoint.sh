#!/bin/sh
# If the node_modules volume is empty (fresh volume), seed it from the
# cached copy that was installed at image build time.
if [ ! -d /app/node_modules/.package-lock.json ] && [ -d /app/_node_modules_cache ]; then
  echo "Populating node_modules from build cache..."
  cp -a /app/_node_modules_cache/. /app/node_modules/
fi
exec "$@"
