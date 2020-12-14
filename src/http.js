/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

var config = require('config');
var request = require('request');
var iconv = require('iconv-lite');
var url = require('url');
var jsdom = require('jsdom');
var { JSDOM } = jsdom;
var wgxpath = require('wicked-good-xpath');
var MIMEType = require("whatwg-mimetype"); // Use the same MIME type library as JSDOM

/**
 * Functions for performing HTTP requests
 * @namespace
 */
Zotero.HTTP = new function() {
	this.StatusError = function(url, status, body) {
		this.message = `HTTP request to ${url} rejected with status ${status}`;
		this.status = status;
		this.responseText = body;
	};
	this.StatusError.prototype = Object.create(Error.prototype);

	this.TimeoutError = function(ms) {
		this.message = `HTTP request has timed out after ${ms}ms`;
	};
	this.TimeoutError.prototype = Object.create(Error.prototype);
	
	this.ResponseSizeError = function(url) {
		this.message = `${url} response exceeds max size`;
	};
	this.ResponseSizeError.prototype = Object.create(Error.prototype);
	
	this.UnsupportedFormatError = function (url, msg) {
		this.message = msg;
	};
	this.UnsupportedFormatError.prototype = Object.create(Error.prototype);
	
	/**
	 * Get a promise for a HTTP request
	 *
	 * @param {String} method The method of the request ("GET", "POST", "HEAD", or "OPTIONS")
	 * @param {String}	url				URL to request
	 * @param {Object} [options] Options for HTTP request:<ul>
	 *         <li>body - The body of a POST request</li>
	 *         <li>headers - Object of HTTP headers to send with the request</li>
	 *         <li>cookieSandbox - The sandbox from which cookies should be taken</li>
	 *         <li>debug - Log response text and status code</li>
	 *         <li>logBodyLength - Length of request body to log</li>
	 *         <li>timeout - Request timeout specified in milliseconds [default 15000]</li>
	 *         <li>responseType - The response type of the request from the XHR spec</li>
	 *         <li>responseTypeMap - A Map of remote content type ('application/x-bibtex') to
	 *              XHR response type ('text'). 'html' and 'xml' imply isHTML() and isXML() from
	 *              whatwg-mimetype. Use an empty string for the key to set a fallback response type;
	 *              otherwise unspecified content types are rejected.</li>
	 *         <li>successCodes - HTTP status codes that are considered successful, or FALSE to allow all</li>
	 *     </ul>
	 * @return {Promise<Object>} A promise resolved with a response object containing:
	 * 		- responseText {String}
	 * 		- headers {Object}
	 * 		- statusCode {Number}
	 */
	this.request = async function(method, requestURL, options = {}) {
		// Default options
		options = Object.assign({
			body: null,
			headers: {},
			cookieSandbox: request.jar(),
			debug: false,
			logBodyLength: 1024,
			timeout: 15000,
			responseType: '',
			successCodes: null,
			maxResponseSize: 50 * 1024 * 1024
		}, options);
		
		if (config.get('persistentCookies')) {
			options.cookieSandbox = true;
		}

		options.headers = Object.assign({
			'User-Agent': config.get('userAgent'),
			'Accept': '*/*'
		}, options.headers);
	
		let logBody = '';
		if (['GET', 'HEAD'].includes(method)) {
			if (options.body != null) {
				throw new Error(`HTTP ${method} cannot have a request body (${options.body})`)
			}
		} else if(options.body) {
			options.body = typeof options.body == 'string' ? options.body : JSON.stringify(options.body);
			
			if (!options.headers) options.headers = {};
			if (!options.headers["Content-Type"]) {
				options.headers["Content-Type"] = "application/x-www-form-urlencoded";
			}
			else if (options.headers["Content-Type"] == 'multipart/form-data') {
				// Allow XHR to set Content-Type with boundary for multipart/form-data
				delete options.headers["Content-Type"];
			}
			
			logBody = `: ${options.body.substr(0, options.logBodyLength)}` +
					options.body.length > options.logBodyLength ? '...' : '';
			// TODO: make sure below does its job in every API call instance
			// Don't display password or session id in console
			logBody = logBody.replace(/password":"[^"]+/, 'password":"********');
			logBody = logBody.replace(/password=[^&]+/, 'password=********');
		}
		Zotero.debug(`HTTP ${method} ${requestURL}${logBody}`);
		
		// Parse URL to escape it (e.g., Unicode characters)
		var parsedURL = new url.URL(requestURL);
		
		let {response, body} = await customRequest(method, parsedURL, options);
		
		if (options.debug) {
			Zotero.debug(`HTTP ${response.statusCode} response: ${body}`);
		}
		
		var result = {
			responseURL: response.request.uri.href,
			headers: response.headers,
			status: response.statusCode
		};
		
		var mimeType = new MIMEType(response.headers['content-type']);
		var responseType = getResponseType(response.headers['content-type'], options);
		result.type = responseType;
		
		if (responseType == 'document') {
			body = decodeContent(body, response.headers['content-type']);
			let dom = new JSDOM(body, {
				url: result.responseURL,
				// Inform JSDOM what content type it's parsing,
				// so it could reject unsupported content types
				contentType: response.headers['content-type']
			});
			
			wgxpath.install(dom.window, true);
			result.response = dom.window.document;
			
			// Follow meta redirects in HTML files
			if (mimeType.isHTML() || mimeType.essence == 'application/xhtml+xml') {
				let meta = result.response.querySelector('meta[http-equiv=refresh]');
				if (meta && meta.getAttribute('content')) {
					let parts = meta.getAttribute('content').split(/;\s*url=/);
					// If there's a redirect to another URL in less than 15 seconds,
					// follow it
					if (parts.length == 2 && parseInt(parts[0]) <= 15) {
						let newURL = parts[1].trim().replace(/^'(.+)'/, '$1');
						newURL = url.resolve(requestURL, newURL);
						
						Zotero.debug("Meta refresh to " + newURL);
						result = Zotero.HTTP.request(method, newURL, options);
					}
				}
			}
		}
		else if (responseType == 'json') {
			result.response = JSON.parse(body.toString());
		}
		else if (responseType == 'text') {
			let charset = mimeType.parameters.get('charset');
			// Treat unknown charset as utf-8
			if (!charset) {
				charset = 'utf8';
			}
			else if (!iconv.encodingExists(charset)) {
				Zotero.debug(`Unknown charset ${charset} -- decoding as UTF-8`);
				charset = 'utf8';
			}
			body = iconv.decode(body, charset);
			result.response = body;
			result.responseText = body;
		}
		else {
			throw new Error("Invalid responseType");
		}
		
		return result;
	};
	
	/**
	 * Load one or more documents
	 *
	 * This should stay in sync with the equivalent function in the client
	 *
	 * @param {String|String[]} urls - URL(s) of documents to load
	 * @param {Function} processor - Callback to be executed for each document loaded
	 * @param {CookieJar} [cookieSandbox] Cookie sandbox object
	 * @return {Promise<Array>} - A promise for an array of results from the processor runs
	 */
	this.processDocuments = async function (urls, processor, options = {}) {
		// Handle old signature: urls, processor, onDone, onError
		if (arguments.length > 3) {
			Zotero.debug("Zotero.HTTP.processDocuments() now takes only 2 arguments -- update your code");
			var onDone = arguments[3];
			var onError = arguments[4];
		}
		
		var cookieSandbox = options.cookieSandbox;
		var headers = options.headers;
		
		if (typeof urls == "string") urls = [urls];
		var funcs = urls.map(url => () => {
			return Zotero.HTTP.request(
				"GET",
				url,
				{
					responseType: 'document',
					cookieSandbox,
					headers
				}
			)
			.then((req) => {
				return processor(req.response, req.responseURL);
			});
		});
		
		// Run processes serially
		// TODO: Add some concurrency?
		var f;
		var results = [];
		while (f = funcs.shift()) {
			try {
				results.push(await f());
			}
			catch (e) {
				if (onError) {
					onError(e);
				}
				throw e;
			}
		}
		
		// Deprecated
		if (onDone) {
			onDone();
		}
		
		return results;
	}
	
	/**
	* Send an HTTP GET request
	*
	* @deprecated Use {@link Zotero.HTTP.request}
	* @param {String}			url				URL to request
	* @param {Function} 		onDone			Callback to be executed upon request completion
	* @param {String}			responseCharset
	* @param {CookieJar}		cookieSandbox
	* @param {Object}			headers			HTTP headers to include with the request
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doGet = function(url, onDone, responseCharset, cookieSandbox, headers) {
		Zotero.debug('Zotero.HTTP.doGet is deprecated. Use Zotero.HTTP.request');
		this.request('GET', url, {responseCharset, headers, cookieSandbox})
		.then(onDone, function(e) {
			onDone({status: e.status, responseText: e.responseText});
			throw (e);
		});
		return true;
	};
	
	/**
	* Send an HTTP POST request
	*
	* @deprecated Use {@link Zotero.HTTP.request}
	* @param {String}			url URL to request
	* @param {String|Object[]}	body Request body
	* @param {Function}			onDone Callback to be executed upon request completion
	* @param {String}			headers Request HTTP headers
	* @param {String}			responseCharset
	* @param {CookieJar}		cookieSandbox
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doPost = function(url, body, onDone, headers, responseCharset, cookieSandbox) {
		Zotero.debug('Zotero.HTTP.doPost is deprecated. Use Zotero.HTTP.request');
		this.request('POST', url, {body, responseCharset, headers, cookieSandbox})
		.then(onDone, function(e) {
			onDone({status: e.status, responseText: e.responseText});
			throw (e);
		});
		return true;
	};
}

/**
 * A temporary workaround for JSDOM content decoding issues.
 * The code is adapted from jsdom/lib/api.js. All dependencies
 * are already used internally in JSDOM
 *
 * TODO: Remove this code when https://github.com/jsdom/jsdom/issues/2495 will be solved
 */
const sniffHTMLEncoding = require("html-encoding-sniffer");
const whatwgEncoding = require("whatwg-encoding");

function decodeContent(html, contentType) {
	let transportLayerEncodingLabel;
	if (contentType) {
		const mimeType = new MIMEType(contentType);
		transportLayerEncodingLabel = mimeType.parameters.get("charset");
	}
	
	html = Buffer.from(html.buffer, html.byteOffset, html.byteLength);
	
	let encoding = sniffHTMLEncoding(html, {defaultEncoding: "UTF-8", transportLayerEncodingLabel});
	html = whatwgEncoding.decode(html, encoding);
	
	return html;
}

/**
 * request.js doesn't support response size limitation, therefore
 * we have to do it manually
 *
 * @param {String} method
 * @param {String} requestURL
 * @param {Object} options
 * @return {Promise<Object>} response, body
 */
function customRequest(method, requestURL, options) {
	return new Promise(function (resolve, reject) {
		let response;
		
		// Make sure resolve/reject is called only once even if request.js
		// is emitting events when it shouldn't
		let returned = false;
		
		// Store buffers in array, because concatenation operation is is unbelievably slow
		let buffers = [];
		let bufferLength = 0;
		
		let req = request({
			uri: requestURL,
			method,
			headers: options.headers,
			timeout: options.timeout,
			body: options.body,
			gzip: true,
			followAllRedirects: true,
			jar: options.cookieSandbox,
			encoding: null // Get body in a buffer
		})
			.on('error', function (err) {
				if (returned) return;
				reject(err);
			})
			.on('data', function (chunk) {
				if (returned) return;
				
				bufferLength += chunk.length;
				buffers.push(chunk);
				
				if (bufferLength > options.maxResponseSize) {
					req.abort();
					returned = true;
					reject(new Zotero.HTTP.ResponseSizeError(requestURL));
				}
			})
			.on('response', function (res) {
				if (returned) return;
				response = res;
				
				if (!response.headers['content-type']) {
					returned = true;
					return reject(new Zotero.HTTP.UnsupportedFormatError(requestURL, 'Missing Content-Type header'));
				}
				
				// Check if the status code is allowed
				// Array of success codes given
				if (options.successCodes) {
					var success = options.successCodes.includes(response.statusCode);
				}
				// Explicit FALSE means allow any status code
				else if (options.successCodes === false) {
					var success = true;
				}
				// Otherwise, 2xx is success
				else {
					var success = response.statusCode >= 200 && response.statusCode < 300;
				}
				if (!success) {
					returned = true;
					return reject(new Zotero.HTTP.StatusError(requestURL, response.statusCode, response.body));
				}
				
				// Check Content-Type before starting the download
				let supported = true;
				let mimeType = new MIMEType(response.headers['content-type']);
				if (options.responseType == 'document') {
					supported = mimeType.isHTML() || mimeType.isXML();
				}
				else if (options.responseTypeMap) {
					let map = options.responseTypeMap;
					supported = (map.has('html') && mimeType.isHTML())
						|| (map.has('xml') && mimeType.isXML())
						|| map.has(mimeType.essence)
						// An empty string for a key allows unspecified types as text
						|| map.has('');
				}
				
				if (!supported) {
					req.abort();
					returned = true;
					return reject(new Zotero.HTTP.UnsupportedFormatError(
						requestURL,
						response.headers['content-type'] + ' is not supported'
					));
				}
				
				// Content-length doesn't always exists or it can be a length of a gzipped content,
				// but it's still worth to do the initial size check
				if (
					response.headers['content-length'] !== undefined &&
					response.headers['content-length'] > options.maxResponseSize
				) {
					req.abort();
					returned = true;
					reject(new Zotero.HTTP.ResponseSizeError(requestURL));
				}
			})
			.on('end', function () {
				if (returned) return;
				returned = true;
				resolve({response, body: Buffer.concat(buffers, bufferLength)});
			});
	});
};

function getResponseType(contentType, options) {
	var mimeType = new MIMEType(contentType);
	if (options.responseType) {
		return options.responseType;
	}
	if (options.responseTypeMap) {
		let map = options.responseTypeMap;
		if (map.has('html') && mimeType.isHTML()) {
			return map.get('html');
		}
		if (map.has('xml') && mimeType.isXML()) {
			return map.get('xml');
		}
		if (map.has(mimeType.essence)) {
			return map.get(mimeType.essence);
		}
	}
	return 'text';
}

module.exports = Zotero.HTTP;
