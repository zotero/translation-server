/* eslint no-process-env: "off" */

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
const cors = require('./cors');

// Prevent UnhandledPromiseRejection crash in Node 15, though this shouldn't be necessary
process.on('unhandledRejection', (reason, promise) => {
	Zotero.debug('Unhandled rejection: ' + (reason.stack || reason), 1)
});

require('./zotero');
const Debug = require('./debug');
const Translators = require('./translators');
const SearchEndpoint = require('./searchEndpoint');
const WebEndpoint = require('./webEndpoint');
const ExportEndpoint = require('./exportEndpoint');
const ImportEndpoint = require('./importEndpoint');

const app = module.exports = new Koa();
if (config.get('trustProxyHeaders')) {
	app.proxy = true;
}
app.use(function (ctx, next) {
	var msg = `${ctx.method} ${ctx.url} from ${ctx.request.ip} "${ctx.headers['user-agent']}"`;
	if (ctx.headers.origin) {
		msg += ` (${ctx.headers.origin})`;
	}
	Zotero.debug(msg);
	return next();
});
app.use(cors);
app.use(bodyParser({ enableTypes: ['text', 'json'], jsonLimit: '5mb' }));
app.use(_.post('/web', WebEndpoint.handle.bind(WebEndpoint)));
app.use(_.post('/search', SearchEndpoint.handle.bind(SearchEndpoint)));
app.use(_.post('/export', ExportEndpoint.handle.bind(ExportEndpoint)));
app.use(_.post('/import', ImportEndpoint.handle.bind(ImportEndpoint)));

Debug.init(process.env.DEBUG_LEVEL ? parseInt(process.env.DEBUG_LEVEL) : 1);
Translators.init()
.then(function () {
	// Don't start server in test mode, since it's handled by supertest
	if (process.env.NODE_ENV == 'test') return;
	
	var port = config.get('port');
	var host = config.get('host');
	app.listen(port, host);
	Debug.log(`Listening on ${host}:${port}`);
});
