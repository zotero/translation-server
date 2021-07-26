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
const Translate = require('./translation/translate');
const TextSearch = require('./textSearch');

var SearchEndpoint = module.exports = {
	handle: async function (ctx, next) {
		ctx.assert(ctx.is('text'), 415);
		
		var data = ctx.request.body;
		
		if (!data) {
			ctx.throw(400, "POST data not provided\n");
		}
		
		// Look for DOI, ISBN, etc.
		var identifiers = Zotero.Utilities.extractIdentifiers(data);
		
		// Use PMID only if it's the only text in the query, with or without a pmid: prefix
		if (identifiers.length && identifiers[0].PMID
				&& identifiers[0].PMID !== data.replace(/^\s*(?:pmid:)?([0-9]+)\s*$/, '$1')) {
			identifiers = [];
		}
		
		// Text search
		if (!identifiers.length) {
			await TextSearch.handle(ctx, next);
			return;
		}
		
		await this.handleIdentifier(ctx, identifiers[0]);
	},
	
	
	handleIdentifier: async function (ctx, identifier) {
		// Identifier
		try {
			var translate = new Translate.Search();
			translate.setIdentifier(identifier);
			let translators = await translate.getTranslators();
			if (!translators.length) {
				ctx.throw(501, "No translators available", { expose: true });
			}
			translate.setTranslator(translators);
			
			var items = await translate.translate({
				libraryID: false
			});
		}
		catch (e) {
			if (e == translate.ERROR_NO_RESULTS) {
				ctx.throw(501, e, { expose: true });
			}
			
			Zotero.debug(e, 1);
			ctx.throw(
				500,
				"An error occurred during translation. "
					+ "Please check translation with the Zotero client.",
				{ expose: true }
			);
		}
		
		// Translation can return multiple items (e.g., a parent item and notes pointing to it),
		// so we have to return an array with keyed items
		var newItems = [];
		items.forEach(item => {
			newItems.push(...Zotero.Utilities.Item.itemToAPIJSON(item));
		});
		
		ctx.response.body = newItems;
	}
};
