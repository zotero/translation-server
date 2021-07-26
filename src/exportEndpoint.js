/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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
const { FORMATS, CONTENT_TYPES } = require('./formats');
const Translate = require('./translation/translate');

var ExportEndpoint = module.exports = {
	handle: async function (ctx, next) {
		ctx.assert(ctx.is('json'), 415);
		
		var items = ctx.request.body;
		
		if (!items) {
			ctx.throw(400, "POST data not provided");
		}
		
		var query = ctx.request.query;
		
		var translatorID;
		
		if (!query.format || !(translatorID = FORMATS[query.format])) {
			ctx.throw(400, "Invalid format specified");
		}
		
		if (!items.length || !items[0].itemType) {
			ctx.throw(400, "Input must be an array of items as JSON");
		}
		
		var translator = Zotero.Translators.get(translatorID);
		var legacy = Zotero.Utilities.semverCompare('4.0.27', translator.metadata.minVersion) > 0;
		
		// Emulate itemsToExportFormat as best as we can
		for (let item of items) {
			// There's no library, so all we have is a key
			if (!item.uri) {
				item.uri = item.key;
				delete item.key;
			}
			
			if (legacy) {
				// SQL instead of ISO 8601
				if (item.dateAdded) item.dateAdded = Zotero.Date.isoToSQL(item.dateAdded);
				if (item.dateModified) item.dateAdded = Zotero.Date.isoToSQL(item.dateModified);
				if (item.accessDate) item.accessDate = Zotero.Date.isoToSQL(item.accessDate);
			}
		}
		
		var translate = new Translate.Export();
		translate.setTranslator(translatorID);
		translate.setItems(items);
		try {
			await new Promise(function (resolve, reject) {
				translate.setHandler("done", function (obj, status) {
					if (!status) {
						reject();
					}
					else {
						ctx.set('Content-Type', CONTENT_TYPES[query.format]);
						ctx.response.body = translate.string;
						resolve();
					}
				});
				translate.translate();
			});
		}
		catch (e) {
			ctx.throw(
				500,
				"An error occurred during translation. Please check translation with the Zotero client.",
				{ expose: true }
			);
		}
	}
};
