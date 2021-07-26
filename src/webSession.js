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
const { CONTENT_TYPES } = require('./formats');
const Translate = require('./translation/translate');
const TLDS = Zotero.requireTranslate('./tlds');
const HTTP = require('./http');
const Translators = require('./translators');
const ImportEndpoint = require('./importEndpoint');
const SearchEndpoint = require('./searchEndpoint');
const { jar: cookieJar } = require('request');

const SERVER_TRANSLATION_TIMEOUT = 30;
const FORWARDED_HEADERS = ['Accept-Language'];

var WebSession = module.exports = function (ctx, next, data, options) {
	this.ctx = ctx;
	this.next = next;
	this.data = data;
	this.options = options;
};

/**
 * @return {Promise<undefined>}
 */
WebSession.prototype.handleURL = async function () {
	if (typeof this.data == 'object') {
		await this.selectDone();
		return;
	}
	
	var url = this.data;
	
	// Forward supported headers
	var headers = {};
	for (let header of FORWARDED_HEADERS) {
		let lc = header.toLowerCase();
		if (this.ctx.headers[lc]) {
			headers[header] = this.ctx.headers[lc];
		}
	}
	
	try {
		var parsedURL = urlLib.parse(url);
	}
	catch (e) {
		this.ctx.throw(400, "Invalid URL provided\n");
	}
	
	// Check domain
	var m = url.match(/https?:\/\/([^/]+)/);
	if (m) {
		let domain = m[1];
		let blacklisted = config.get("blacklistedDomains")
			.some(x => x && new RegExp(x).test(domain));
		if (blacklisted) {
			let doi = this.cleanDOIFromURL(url);
			if (!doi) {
				this.ctx.throw(500, "An error occurred retrieving the document\n");
			}
			await SearchEndpoint.handleIdentifier(this.ctx, { DOI: doi });
			return;
		}
	}
	
	var responseTypeMap = new Map([
		['html', 'document'],
		['application/xhtml+xml', 'document'],
		['text/plain', 'text']
	]);
	// Force all import content types to text
	for (let type in CONTENT_TYPES) {
		let contentType = CONTENT_TYPES[type];
		if (contentType == 'text/html') continue;
		if (responseTypeMap.has(contentType)) continue;
		responseTypeMap.set(contentType, 'text');
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
		this._cookieSandbox = cookieJar();
		
		let resolve;
		let reject;
		let promise = new Promise(function () {
			resolve = arguments[0];
			reject = arguments[1];
		});
		
		let translate = new Translate.Web();
		let translatePromise;
		translate.setHandler("translators", async function (translate, translators) {
			// Force single-page saving
			if (this.options.single) {
				translators = translators.filter(t => t.itemType != 'multiple');
			}
			
			try {
				translatePromise = this.translate(translate, translators);
				await translatePromise;
				resolve();
			}
			catch (e) {
				reject(e);
			}
		}.bind(this));
		translate.setHandler("select", (translate, items, callback) => {
			try {
				this.select(
					url,
					translate,
					items,
					callback,
					translatePromise
				);
			}
			catch (e) {
				Zotero.debug(e, 1);
				reject(e);
				// Resolve the translate promise
				callback([]);
				return;
			}
			resolve();
		});
		translate.setCookieSandbox(this._cookieSandbox);
		translate.setRequestHeaders(headers);
		
		try {
			let req = await Zotero.HTTP.request(
				"GET",
				url,
				{
					responseTypeMap,
					cookieSandbox: this._cookieSandbox,
					headers
				}
			);
			if (req.type === 'document') {
				translate.setDocument(req.response);
				// This could be optimized by only running detect on secondary translators
				// if the first fails, but for now just run detect on all
				translate.getTranslators(true);
			}
			else {
				Zotero.debug(`Handling ${req.headers['content-type']} as import`);
				this.ctx.request.body = req.response;
				await ImportEndpoint.handle(this.ctx);
				return;
			}
			
			return promise;
		}
		catch (e) {
			Zotero.debug(e, 1);
			
			if (e instanceof Zotero.HTTP.StatusError && e.status == 404) {
				this.ctx.throw(400, "Remote page not found");
			}
			
			let doi = this.cleanDOIFromURL(url);
			if (doi) {
				Zotero.debug(`Error translating page -- continuing with DOI ${doi} from URL`);
				await SearchEndpoint.handleIdentifier(this.ctx, { DOI: doi });
				return;
			}
			
			if (e instanceof Zotero.HTTP.ResponseSizeError) {
				this.ctx.throw(400, "Response exceeds max size");
			}
			
			if (e instanceof Zotero.HTTP.UnsupportedFormatError) {
				this.ctx.throw(400, "The remote document is not in a supported format");
			}
			
			// No more URLs to try
			if (i == urlsToTry.length - 1) {
				this.ctx.throw(500, "An error occurred retrieving the document");
			}
		}
	}
};


/**
 * Called when translators are available to perform translation
 *
 * @return {Promise<undefined>}
 */
WebSession.prototype.translate = async function (translate, translators) {
	// No matching translators
	if (!translators.length) {
		Zotero.debug("No translators found -- saving as a webpage");
		this.saveWebpage(translate);
		return;
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
				this.saveWebpage(translate);
				return;
			}
			
			// Try next translator
		}
	}
	
	//this._cookieSandbox.clearTimeout();
	
	// Check for DOI in URL if no results
	if (!items.length) {
		let doi = this.cleanDOIFromURL(translate.location);
		if (doi) {
			Zotero.debug(`No results -- continuing with DOI ${doi} from URL`);
			await SearchEndpoint.handleIdentifier(this.ctx, { DOI: doi });
			return;
		}
	}
	
	var json = [];
	for (let item of items) {
		json.push(...Zotero.Utilities.Item.itemToAPIJSON(item));
	}
	this.ctx.response.status = 200;
	this.ctx.response.body = json;
};

/**
 * TEMP: Remove once there's a generic webpage translator
 *
 * @return {undefined}
 */
WebSession.prototype.saveWebpage = function (translate) {
	let head = translate.document.documentElement.querySelector('head');
	if (!head) {
		// XXX better status code?
		this.ctx.throw(501, "No translators available\n");
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
	this.ctx.response.body = Zotero.Utilities.Item.itemToAPIJSON(data);
};


/**
 * Called if multiple items are available for selection from the translator
 */
WebSession.prototype.select = function (url, translate, items, callback, promise) {
	// Fix for translators that return item list as array rather than object
	if (Array.isArray(items)) {
		let newItems = {};
		for (let i = 0; i < items.length; i++) {
			newItems[i] = items[i];
		}
		items = newItems;
	}
	
	// If translator returns objects with 'title' and 'checked' properties (e.g., PubMed),
	// extract title
	for (let i in items) {
		if (items[i].title) {
			items[i] = items[i].title;
		}
	}
	
	this.id = Zotero.Utilities.randomString(15);
	this.started = Date.now();
	this.url = url;
	this.translate = translate;
	this.items = items;
	this.selectCallback = callback;
	this.translatePromise = promise;
	
	// Send "Multiple Choices" HTTP response
	//this._cookieSandbox.clearTimeout();
	this.ctx.response.status = 300;
	this.ctx.response.body = {
		url,
		session: this.id,
		items
	};
};

/**
 * Called when items have been selected by the client
 */
WebSession.prototype.selectDone = function () {
	var url = this.data.url;
	var selectedItems = this.data.items;
	
	if (this.url != url) {
		this.ctx.throw(409, "'url' does not match URL in session");
	}
	
	if (!selectedItems) {
		this.ctx.throw(400, "'items' not provided");
	}
	
	// Make sure items are actually available
	var haveItems = false;
	for (let i in selectedItems) {
		if (this.items[i] === undefined || this.items[i] !== selectedItems[i]) {
			this.selectCallback([]);
			this.ctx.throw(409, "Items specified do not match items available");
		}
		haveItems = true;
	}
	
	// Make sure at least one item was specified
	if (!haveItems) {
		this.selectCallback([]);
		this.ctx.throw(400, "No items specified");
	}
	
	// Run select callback
	this.selectCallback(selectedItems);
	
	// The original translate promise in this.translate() from the first request is stalled while
	// waiting for item select from the client. When the follow-up request comes in, the new ctx
	// object is swapped in by the endpoint code, and the select callback above allows the
	// translate promise to complete and the translated items to be assigned to the new ctx
	// response body.
	return this.translatePromise;
};


/**
 * Called if the request timed out before it could complete
 */
/*WebSession.prototype.timeout = function() {
	this.sendResponse(504, "text/plain", "Translation timed out.\n");
};*/





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
WebSession.prototype.deproxifyURL = function (url) {
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
};


WebSession.prototype.cleanDOIFromURL = function (url) {
	let doi = Zotero.Utilities.cleanDOI(decodeURIComponent(url));
	if (doi) {
		// Stop at query string or ampersand
		doi = doi.replace(/[?&].*/, '');
	}
	return doi || null;
};
