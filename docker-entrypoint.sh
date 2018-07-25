#!/bin/bash

echo "Updating zotero translators"
git submodule update --recursive --remote

exec npm start
