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
var jsdom = require('jsdom');
var { JSDOM } = jsdom;
var wgxpath = require('wicked-good-xpath');

/**
 * Functions for performing HTTP requests
 * @namespace
 */
Zotero.HTTP = new function() {
	this.StatusError = function(url, status, body) {
		this.message = `HTTP request to ${url} rejected with status ${xmlhttp.status}`;
		this.status = status;
		this.responseText = body;
	};
	this.StatusError.prototype = Object.create(Error.prototype);

	this.TimeoutError = function(ms) {
		this.message = `HTTP request has timed out after ${ms}ms`;
	};
	this.TimeoutError.prototype = Object.create(Error.prototype);
	
	/**
	 * Get a promise for a HTTP request
	 *
	 * @param {String} method The method of the request ("GET", "POST", "HEAD", or "OPTIONS")
	 * @param {String}	url				URL to request
	 * @param {Object} [options] Options for HTTP request:<ul>
	 *         <li>body - The body of a POST request</li>
	 *         <li>headers - Object of HTTP headers to send with the request</li>
	 *         <li>debug - Log response text and status code</li>
	 *         <li>logBodyLength - Length of request body to log</li>
	 *         <li>timeout - Request timeout specified in milliseconds [default 15000]</li>
	 *         <li>responseType - The response type of the request from the XHR spec</li>
	 *         <li>successCodes - HTTP status codes that are considered successful, or FALSE to allow all</li>
	 *     </ul>
	 * @return {Promise<Object>} A promise resolved with a response object containing:
	 * 		- responseText {String}
	 * 		- headers {Object}
	 * 		- statusCode {Number}
	 */
	this.request = function(method, url, options = {}) {
		// Default options
		options = Object.assign({
			body: null,
			headers: {},
			debug: false,
			logBodyLength: 1024,
			timeout: 15000,
			responseType: '',
			successCodes: null
		}, options);
		
		options.headers = Object.assign({
			'User-Agent': config.get('userAgent')
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
		Zotero.debug(`HTTP ${method} ${url}${logBody}`);
		
		return new Promise(function(resolve, reject) {
			request({
				uri: url,
				method,
				headers: options.headers,
				timeout: options.timeout,
				body: options.body,
			}, function(error, response, body) {
				if (error) {
					return reject(error);
				}
				if (options.successCodes !== null && !options.successCodes.includes(response.statusCode)) {
					return reject(new Zotero.HTTP.StatusError(url, response.statusCode, response.body));
				}

				if (options.debug) {
					Zotero.debug(`HTTP ${response.statusCode} response: ${body}`);
				}
				return resolve({
					responseText: body,
					headers: response.headers,
					statusCode: response.statusCode
				});
			});
		});
		
	};
	 
	/**
	 * Load one or more documents
	 *
	 * This should stay in sync with the equivalent function in the client
	 *
	 * @param {String|String[]} urls - URL(s) of documents to load
	 * @param {Function} processor - Callback to be executed for each document loaded
	 * @return {Promise<Array>} - A promise for an array of results from the processor runs
	 */
	this.processDocuments = async function (urls, processor) {
		// Handle old signature: urls, processor, onDone, onError
		if (arguments.length > 2) {
			Zotero.debug("Zotero.HTTP.processDocuments() now takes only 2 arguments -- update your code");
			var onDone = arguments[2];
			var onError = arguments[3];
		}
		
		if (typeof urls == "string") urls = [urls];
		var funcs = urls.map(url => () => {
			return Zotero.HTTP.request(
				"GET",
				url,
				{
					responseType: 'document'
				}
			)
			.then((response) => {
				var dom = new JSDOM(response.responseText, { url });
				wgxpath.install(dom.window, true);
				return processor(dom.window.document, url);
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
}

module.exports = Zotero.HTTP;