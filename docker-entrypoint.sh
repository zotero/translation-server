#!/bin/bash

# will be deprecated when https://github.com/zotero/translation-server/issues/1 will be released
echo "-> Updating zotero translators"
cd /app/modules/translators/
git pull --ff-only origin master

cd /app/
exec npm start
