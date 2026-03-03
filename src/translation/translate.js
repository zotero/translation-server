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

Zotero.Translate = Zotero.requireTranslate('./translation/translate');

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
var jsdom = require('jsdom');
var { JSDOM } = jsdom;
var serializeNode = require("w3c-xmlserializer");

// Shim innerText for JSDOM, see https://github.com/jsdom/jsdom/issues/1245
// JSDOM interfaces are recreated per instance, so we use the beforeParse hook
// to apply shims once per instance (not on every window access).
function shimInnerText(window) {
	Object.defineProperty(window.Attr.prototype, 'innerText', {
		get() {
			return this.textContent;
		},
		set(value) {
			this.textContent = value;
		},
		configurable: true,
	});
	Object.defineProperty(window.Node.prototype, 'innerText', {
		get() {
			// innerText in the browser is more sophisticated, but this removes most unwanted content
			// https://github.com/jsdom/jsdom/issues/1245#issuecomment-584677454
			let el = this.cloneNode(true);
			el.querySelectorAll('script, style').forEach(s => s.remove());
			return el.textContent;
		},
		set(value) {
			this.textContent = value;
		},
		configurable: true,
	});
}

// Wrap JSDOM constructor to inject innerText shim via beforeParse for all instances
jsdom.JSDOM = class extends JSDOM {
	constructor(input, options = {}) {
		var originalBeforeParse = options.beforeParse;
		options.beforeParse = function (window) {
			shimInnerText(window);
			if (originalBeforeParse) {
				originalBeforeParse(window);
			}
		};
		super(input, options);
	}
};
JSDOM = jsdom.JSDOM;

var dom = new JSDOM('<html></html>');
wgxpath.install(dom.window, true);
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = class XMLSerializer {
	serializeToString(node) {
		return serializeNode(node);
	}
};

module.exports = Zotero.Translate;
