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

const Koa = require('koa');
const _ = require('koa-route');
const bodyParser = require('koa-bodyparser');
const cors = require('./cors');
const serverless = require('serverless-http');

require('./zotero');
const Debug = require('./debug');
var Translators; // Translators module is cashed
const SearchEndpoint = require('./searchEndpoint');
const WebEndpoint = require('./webEndpoint');
const ExportEndpoint = require('./exportEndpoint');
const ImportEndpoint = require('./importEndpoint');

const app = module.exports = new Koa();
app.use(cors);
app.use(bodyParser({enableTypes: ['text', 'json']}));
app.use(_.post('/web', WebEndpoint.handle.bind(WebEndpoint)));
app.use(_.post('/search', SearchEndpoint.handle.bind(SearchEndpoint)));
app.use(_.post('/export', ExportEndpoint.handle.bind(ExportEndpoint)));
app.use(_.post('/import', ImportEndpoint.handle.bind(ImportEndpoint)));

Debug.init(1);

const handler = serverless(app);
module.exports.handler = async function (event, context) {
	if (!Translators) {
		Translators = require('./translators');
		await Translators.init();
	}
	
	var result = await handler(event, context);
	return result;
};
