/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2018 Center for History and New Media
					George Mason University, Fairfax, Virginia, USA
					http://zotero.org
	
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

var process = require('process');
var Zotero = require('../src/zotero');
var Translate = require('../src/translation/translate');
var HTTP = require('../src/http');
var Debug = require('../src/debug');
var Translators = require('../src/translators');

var testURL = process.argv[2];

(async function() {
	Debug.init(1);
	try {
		await Translators.init();
		var translate = new Translate.Web();
		HTTP.processDocuments(testURL, async function(doc) {
			try {
				translate.setDocument(doc);
				translate.setHandler('select', function(translate, items, callback) {
					Zotero.debug(`Translate: Selecting from: ${JSON.stringify(items)}`);
					var selected = {};
					selected[Object.keys(items)[0]] = items[Object.keys(items)[0]];
					return callback(selected);
				});
				var items = await translate.translate({libraryID: false});
				Zotero.debug(items);
			} catch (e) {
				Zotero.debug(e);
			}
		});
	} catch (e) {
		Debug.log(e);
	}
}());
