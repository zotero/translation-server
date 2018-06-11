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

const config = require('config');
const _ = require('koa-route');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const app = module.exports = new Koa();

const Debug = require('./debug');
const Translators = require('./translators');
const Endpoints = require('./endpoints');

(async function() {
	Debug.init(1);
	await Translators.init();
	
	app.use(bodyParser());
	app.use(_.post('/search', Endpoints.Search.handle.bind(Endpoints.Search)));
	var port = config.get('port');
	app.listen(port);
	Debug.log(`Listening on 0.0.0.0:${port}`);
}());
