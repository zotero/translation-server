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

Zotero.Translate = Zotero.require('./translation/translate');

Zotero.Translate = {...Zotero.Translate,
	SandboxManager: require('./sandboxManager'),
	...require('./translate_item')
};
Zotero.Translate.ItemSaver.prototype.saveItems = async function (jsonItems, attachmentCallback, itemsDoneCallback) {
	this.items = (this.items || []).concat(jsonItems)
	return jsonItems
}

// Translation architecture shims and monkey-patches
var wgxpath = require('wicked-good-xpath');
global.XPathResult = wgxpath.XPathResultType;
var { JSDOM } = require('jsdom');
var dom = new JSDOM('<html></html>');
wgxpath.install(dom.window, true);
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = require("w3c-xmlserializer/lib/XMLSerializer").interface;
global.Services = {
	// nsIVersionComparator
	vc: {
		compare: function (a, b) {
			// Only worry about the major version (4. vs. 5.)
			var aParts = a.split(/\./g);
			var bParts = b.split(/\./g);
			return aParts[0] - bParts[0];
		}
	}
};

// Shimming innerText property for JSDOM attributes, see https://github.com/jsdom/jsdom/issues/1245
var Attr = require('jsdom/lib/jsdom/living/generated/Attr');
Object.defineProperty(Attr.interface.prototype, 'innerText', {
	get: function() { return this.textContent },
	set: function(value) { this.textContent = value },
	configurable: true,
});
var Node = require('jsdom/lib/jsdom/living/generated/Node');
Object.defineProperty(Node.interface.prototype, 'innerText', {
	get: function() { return this.textContent },
	set: function(value) { this.textContent = value },
	configurable: true,
});


module.exports = Zotero.Translate;
