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
const urlLib = require('url');

const Translate = require('./translation/translate');
const HTTP = require('./http');
const Debug = require('./debug');
const Translators = require('./translators');

// Timeout for select request, in seconds
const SERVER_SELECT_TIMEOUT = 120;
const SERVER_TRANSLATION_TIMEOUT = 30;


var Endpoints = module.exports = {
	Search: {
		handle: async function (ctx, next) {
			ctx.assert(ctx.is('json'), 415);
			
			var data = ctx.request.body;
			
			if (!data) {
				return ctx.throw(400, "POST data not provided\n");
			}
			
			// Select items
			if (data.token) {
				if (!data.items) {
					return ctx.throw(400, "'items' not provided\n");
				}
			}
			// Initial query
			else {
				if (!data.query) {
					return ctx.throw(400, "No query specified\n");
				}
				data.token = Zotero.Utilities.randomString(32);
			}
			
			// URL
			if (data.query.match(/^https?:/)) {
				return this.handleURL(ctx, next, data.query);
			}
			
			return ctx.throw(501);
		},
		
		handleURL: async function (ctx, next, url) {
			try {
				var parsedURL = urlLib.parse(url);
			}
			catch (e) {
				return ctx.throw(400, "Invalid URL provided\n");
			}
			
			// Check domain
			var m = url.match(/https?:\/\/([^/]+)/);
			if (m) {
				let domain = m[1];
				let blacklisted = config.get("blacklistedDomains")
					.some(x => x && new RegExp(x).test(domain));
				if (blacklisted) {
					let doi = Zotero.Utilities.cleanDOI(url);
					if (!doi) {
						return ctx.throw(500, "An error occurred retrieving the document\n");
					}
					return this.handleDOI(ctx, next, doi);
				}
			}
			
			// If a doi.org URL, use search handler
			if (url.match(/^https?:\/\/[^\/]*doi\.org\//)) {
				let doi = Zotero.Utilities.cleanDOI(url);
				return this.handleDOI(ctx, next, doi);
			}
			
			var urlsToTry = config.get('deproxifyURLs') ? this.deproxifyURL(url) : [url];
			for (let i = 0; i < urlsToTry.length; i++) {
				let url = urlsToTry[i];
				if (urlsToTry.length > 1) {
					Zotero.debug("Trying " + url);
				}
				
				/*let runningInstance;
				if ((runningInstance = Zotero.Server.Translation.waitingForSelection[data.sessionid])
						&& data.items) {
					// Already waiting for a items response, so just pass this there
					runningInstance._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
						runningInstance.timeout.bind(runningInstance));
					runningInstance.sendResponse = sendResponseCallback;
					runningInstance.selectDone(data.items);
					break;
				}*/
				
				// New request
				/*this._cookieSandbox = new Zotero.CookieSandbox(null, url);
				this._cookieSandbox.setTimeout(SERVER_TRANSLATION_TIMEOUT*1000,
					this.timeout.bind(this));*/
				
				let resolve;
				let promise = new Promise(function () {
					resolve = arguments[0];
				});
				
				let translate = new Translate.Web();
				translate.setHandler("translators", (translate, translators) => {
					resolve(this.translators(ctx, next, translate, translators));
				});
				translate.setHandler("select", (translate, itemList) => {
					resolve(this.select(ctx, next, translate, itemList));
				});
				//translate.setCookieSandbox(this._cookieSandbox);
				
				try {
					await HTTP.processDocuments(
						[url],
						(doc) => {
							translate.setDocument(doc);
							// This could be optimized by only running detect on secondary translators
							// if the first fails, but for now just run detect on all
							return translate.getTranslators(true);
						}/*,
						this._cookieSandbox*/
					);
					return promise;
				}
				catch (e) {
					Zotero.debug(e, 1);
					
					//Parse URL up to '?' for DOI
					let doi = Zotero.Utilities.cleanDOI(decodeURIComponent(url).match(/[^\?]+/)[0]);
					if (doi) {
						Zotero.debug("Found DOI in URL -- continuing with " + doi);
						return this.handleDOI(ctx, next, doi);
					}
					
					// No more URLs to try
					if (i == urlsToTry.length - 1) {
						return ctx.throw(500, "An error occurred retrieving the document\n");
					}
				}
			}
			
			// GC every 10 requests
			/*if((++Zotero.Server.Translation.requestsSinceSelectionCollection) == 10) {
				for (let i in Zotero.Server.Translation.waitingForSelection) {
					let instance = Zotero.Server.Translation.waitingForSelection[i];
					instance.collect();
				}
				Zotero.Server.Translation.requestsSinceSelectionCollection = 0;
			}*/
		},
		
		/**
		 * Called to check whether this request should be aborted due to timeout, and if so, do the
		 * aborting
		 * @param {Boolean} force Whether to abort the request regardless of timeout
		 */
		collect: function (force) {
			if(!force && this._responseTime && Date.now() < this._responseTime+SERVER_SELECT_TIMEOUT*1000) return;
			delete Zotero.Server.Translation.waitingForSelection[this._data.sessionid];
		},
		
		/**
		 * Called when translators are available
		 */
		translators: async function (ctx, next, translate, translators) {
			// No matching translators
			if (!translators.length) {
				return this.saveWebpage(ctx, next, translate);
			}
			
			var translator;
			var items;
			while (translator = translators.shift()) {
				translate.setTranslator(translator);
				try {
					items = await translate.translate({
						libraryID: false
					});
					break;
				}
				catch (e) {
					Zotero.debug("Translation using " + translator.label + " failed", 1);
					Zotero.debug(e, 1);
					
					// If no more translators, save as webpage
					if (!translators.length) {
						return this.saveWebpage(ctx, next, translate);
					}
					
					// Try next translator
				}
			}
			
			//this._cookieSandbox.clearTimeout();
			//this.collect(true);
			
			//this.sendResponse(400, "text/plain", "Invalid input provided.\n");
			var json = [];
			for (let item of items) {
				json.push(...Zotero.Utilities.itemToAPIJSON(item));
			}
			ctx.response.body = json;
		},
		
		// TEMP: Remove once there's a generic webpage translator
		saveWebpage: function (ctx, next, translate) {
			//this.collect(true);
			
			let head = translate.document.documentElement.querySelector('head');
			if (!head) {
				// XXX better status code?
				return ctx.throw(501, "No translators available\n");
			}
			
			// TEMP: Return basic webpage item for HTML
			let description = head.querySelector('meta[name=description]');
			if (description) {
				description = description.getAttribute('content');
			}
			let data = {
				itemType: "webpage",
				url: translate.document.location.href,
				title: translate.document.title,
				abstractNote: description,
				accessDate: Zotero.Date.dateToISO(new Date())
			};
			ctx.response.body = Zotero.Utilities.itemToAPIJSON(data);
		},
		
		
		/**
		 * Try to determine whether the passed URL looks like a proxied URL based on TLDs in the
		 * middle of the domain and return a list of likely URLs, starting with the longest domain
		 * and ending with the original one
		 *
		 * E.g., https://www-example-co-uk.mutex.gmu.edu ->
		 *
		 * [
		 *   'https://www.example.co.uk',
		 *   'https://www.example.co',
		 *   'https://www-example-co-uk.mutex.gmu.edu',
		 * ]
		 *
		 * Based on Zotero.Proxies.getPotentialProxies()
		 */
		deproxifyURL: function (url) {
			var urlToProxy = {
				[url]: null
			};
			
			// if there is a subdomain that is also a TLD, also test against URI with the domain
			// dropped after the TLD
			// (i.e., www.nature.com.mutex.gmu.edu => www.nature.com)
			var m = /^(https?:\/\/)([^\/]+)/i.exec(url);
			if (m) {
				// First, drop the 0- if it exists (this is an III invention)
				var host = m[2];
				if (host.substr(0, 2) === "0-") host = host.substr(2);
				var hostnameParts = [host.split(".")];
				if (m[1] == 'https://') {
					// try replacing hyphens with dots for https protocol
					// to account for EZProxy HttpsHypens mode
					hostnameParts.push(host.split('.'));
					hostnameParts[1].splice(0, 1, ...(hostnameParts[1][0].replace(/-/g, '.').split('.')));
				}
				
				for (let i=0; i < hostnameParts.length; i++) {
					let parts = hostnameParts[i];
					// If hostnameParts has two entries, then the second one is with replaced hyphens
					let dotsToHyphens = i == 1;
					// skip the lowest level subdomain, domain and TLD
					for (let j=1; j<parts.length-2; j++) {
						// if a part matches a TLD, everything up to it is probably the true URL
						if (TLDS[parts[j].toLowerCase()]) {
							var properHost = parts.slice(0, j+1).join(".");
							// protocol + properHost + /path
							var properURL = m[1]+properHost + url.substr(m[0].length);
							var proxyHost = parts.slice(j + 1).join('.');
							urlToProxy[properURL] = {scheme: '%h.' + proxyHost + '/%p', dotsToHyphens};
						}
					}
				}
			}
			var urls = Object.keys(urlToProxy);
			urls.sort((a, b) => b.length - a.length);
			urls.push(urls.shift());
			return urls;
		},
		
		
		/**
		 * Called if multiple items are available for selection
		 */
		"select":function(translate, itemList, callback) {
			this._selectCallback = callback;
			this._itemList = itemList;
			
			if(this._data.items) {	// Items passed in request
				this.selectDone(this._data.items);
			} else {				// Items needed for response
				// Fix for translators that don't create item lists as objects
				if(itemList.push && typeof itemList.push === "function") {
					var newItemList = {};
					for(var item in itemList) {
						newItemList[item] = itemList[item];
					}
					itemList = newItemList;
				}
				
				// Send "Multiple Choices" HTTP response
				this._cookieSandbox.clearTimeout();
				ctx.response.status = 300;
				ctx.response.body = itemList;
				
				this._responseTime = Date.now();
				//Zotero.Server.Translation.waitingForSelection[this._data.sessionid] = this;
			}
		},
		
		/**
		 * Called when items have been selected
		 */
		"selectDone":function(selectItems) {
			// Make sure items are actually available
			var haveItems = false;
			for(var i in selectItems) {
				if(this._itemList[i] === undefined || this._itemList[i] !== selectItems[i]) {
					this.collect(true);
					this.sendResponse(409, "text/plain", "Items specified do not match items available\n");
					return;
				}
				haveItems = true;
			}
			
			// Make sure at least one item was specified
			if(!haveItems) {
				this.collect(true);
				this.sendResponse(400, "text/plain", "No items specified\n");
				return;
			}
			
			// Run select callback
			this._selectCallback(selectItems);
		},
		
		/**
		 * Called if the request timed out before it could complete
		 */
		"timeout":function() {
			this.sendResponse(504, "text/plain", "Translation timed out.\n");		
		},
		
		
		handleDOI: async function (ctx, next, doi) {
			return ctx.throw(501);
		}
	}
};
