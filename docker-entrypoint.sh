#!/bin/bash

# will be deprecated when https://github.com/zotero/translation-server-v2/issues/1 will be released
echo "Updating zotero translators"
cd /app/modules/translators/
git pull origin master

cd /app/
exec npm start
