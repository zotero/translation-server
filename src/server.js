/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     https://www.zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const process = require('process');
const config = require('config');
const Koa = require('koa');
const _ = require('koa-route');
const bodyParser = require('koa-bodyparser');

require('./zotero');
const Debug = require('./debug');
const Translators = require('./translators');
const SearchEndpoint = require('./searchEndpoint');
const WebEndpoint = require('./webEndpoint');

const app = module.exports = new Koa();
app.use(bodyParser({ enableTypes: ['text', 'json']}));
app.use(_.post('/web', WebEndpoint.handle.bind(WebEndpoint)));
app.use(_.post('/search', SearchEndpoint.handle.bind(SearchEndpoint)));

Debug.init(1);
Translators.init()
.then(function () {
	// Don't start server in test mode, since it's handled by supertest
	if (process.env.NODE_ENV == 'test') return;
	
	var port = config.get('port');
	app.listen(port);
	Debug.log(`Listening on 0.0.0.0:${port}`);
});
