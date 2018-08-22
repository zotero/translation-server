#!/bin/bash

# will be deprecated when https://github.com/zotero/translation-server-v2/issues/1 will be released
if [ ! -d /app/modules/translators/ ]; then
  echo "-> Clonning zotero translators (initialization step)"
  git clone https://github.com/zotero/translators /app/modules/translators/
fi
echo "-> Updating zotero translators"
cd /app/modules/translators/
git pull origin master

cd /app/
exec npm start
