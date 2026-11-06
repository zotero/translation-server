#!/bin/bash
set -e

if [ -d "/app/modules/translators/.git" ]; then
    echo "-> Updating zotero translators"
    git -C /app/modules/translators/ pull --ff-only origin master || echo "-> Warning: Could not update translators"
fi

cd /app/
exec npm start

