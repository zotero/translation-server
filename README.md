# Zotero Translation Server (Node.js)

Initial development. Try:

```
git clone --recurse-submodules -j8 git@github.com:zotero/translation-server-v2.git
cd translation-server-v2/
npm i
npm start
curl -d 'https://www.nytimes.com/2018/06/11/technology/net-neutrality-repeal.html' -H 'Content-Type: text/plain' http://127.0.0.1:1969/search
```
