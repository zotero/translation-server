/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

// Enumeration of types of translators
var TRANSLATOR_TYPES = {"import":1, "export":2, "web":4, "search":8};

const fs = require('fs');
const path = require('path');

var Translators = Zotero.requireTranslate('./translators');

/**
 * Singleton to handle loading and caching of translators
 * @namespace
 */
Translators = Object.assign(Translators, new function() {
	var _cache, _translators;
	var _initialized = false;
	const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
	
	/**
	 * Initializes translator cache, loading all translators into memory
	 * @param {Zotero.Translators[]} [translators] List of translators. If not specified, they will be
     * retrieved from storage.
	 */
	this.init = async function(translators) {
		if(!translators) {
			translators = await this.load();
		}
		
		_cache = {"import":[], "export":[], "web":[], "search":[]};
		_translators = {};
		_initialized = true;
		
		// Build caches
		for(var i=0; i<translators.length; i++) {
			try {
				var translator = new Zotero.Translator(translators[i]);
				_translators[translator.translatorID] = translator;
				
				for(var type in TRANSLATOR_TYPES) {
					if(translator.translatorType & TRANSLATOR_TYPES[type]) {
						_cache[type].push(translator);
					}
				}
			} catch(e) {
				Zotero.logError(e);
				try {
					Zotero.logError("Could not load translator "+JSON.stringify(translators[i]));
				} catch(e) {}
			}
		}
		
		// Sort by priority
		var cmp = function (a, b) {
			if (a.priority > b.priority) {
				return 1;
			}
			else if (a.priority < b.priority) {
				return -1;
			}
		}
		for(var type in _cache) {
			_cache[type].sort(cmp);
		}
		Zotero.debug(`Translators initialized with ${translators.length} loaded`);
	};
	
	this.load = async function() {
		var translatorsDirPath = path.resolve(path.resolve(__dirname, '..'), Zotero.Prefs.get("translatorsDirectory"));
		
		if(!await new Promise(resolve => fs.access(translatorsDirPath, (err) => resolve(!err)))) {
			throw new Error("Translators directory "+translatorsDirPath+" is not "+
				"accessible. Please set this correctly in config.js.\n")
		}

		var translatorFilePaths = await new Promise((resolve, reject) => 
			fs.readdir(translatorsDirPath, (err, files) => err ? reject(err) : resolve(files)));
		var translators = [];
		for (let filePath of translatorFilePaths)  {
			if (filePath[0] === '.' || filePath.substr(filePath.length-3) !== ".js") continue;
			filePath = path.resolve(translatorsDirPath, filePath);
			var data = await new Promise((resolve, reject) => 
				fs.readFile(filePath, "utf8", (err, data) => err ? reject(err) : resolve(data)));
			
			// Strip off byte order mark, if one exists
			if(data[0] === "\uFEFF") data = data.substr(1);
			
			// We assume lastUpdated is at the end to avoid running the regexp on more than necessary
			var lastUpdatedIndex = data.indexOf('"lastUpdated"');
			if (lastUpdatedIndex == -1) {
				Zotero.debug("Invalid or missing translator metadata JSON object in " + filename);
				continue;
			}
			
			// Add 50 characters to clear lastUpdated timestamp and final "}"
			var header = data.substr(0, lastUpdatedIndex + 50);
			var m = infoRe.exec(header);
			if (!m) {
				Zotero.debug("Invalid or missing translator metadata JSON object in " + filename);
				continue;
			}
			
			var metadataString = m[0];
			
			try {
				var info = JSON.parse(metadataString);
			} catch(e) {
				Zotero.debug("Invalid or missing translator metadata JSON object in " + filename);
				continue;
			}
			info.code = data;
			// We don't ever want to reload from disk again (and don't have the code to do that either)
			info.cacheCode = true;
			
			translators.push(info);
		}
		return translators;
	};
	
	/**
	 * Gets the translator that corresponds to a given ID
	 *
	 * @param {String} id The ID of the translator
	 */
	this.get = function (id) {
		if (!_initialized) {
			throw new Error("Trying to retrieve a translator without initalizing translator store");
		}
		var translator = _translators[id];
		if (!translator) {
			return false;
		}
		return translator;
	};
	
	/**
	 * Gets all translators for a specific type of translation
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 * @param {Boolean} [debugMode] Whether to assume debugging mode. If true, code is included for 
	 *                              unsupported translators, and code originally retrieved from the
	 *                              repo is re-retrieved from Zotero Standalone.
	 */
	this.getAllForType = async function (type, debugMode) {
		if(!_initialized) Zotero.Translators.init()
		var translators = _cache[type].slice(0);
		var codeGetter = new Zotero.Translators.CodeGetter(translators, debugMode);
		return codeGetter.getAll().then(function() {
			return translators;
		});
	};

	this.getCodeForTranslator = Zotero.Promise.method(function (translator) {
		if (translator.code) {
			return translator.code;
		} else {
			throw new Error(`Code for translator ${translator.translatorID} is missing`);
		}
	});
	
	/**
	 * Gets web translators for a specific location
	 * @param {String} uri The URI for which to look for translators
	 * @return {Promise<Array[]>} - A promise for a 2-item array containing an array of translators and
	 *     an array of functions for converting URLs from proper to proxied forms
	 */
	this.getWebTranslatorsForLocation = async function (URI, rootURI) {
		var isFrame = URI !== rootURI;
		if(!_initialized) Zotero.Translators.init();
		var allTranslators = _cache["web"];
		var potentialTranslators = [];
		var proxies = [];
		
		var rootSearchURIs = Zotero.Proxies.getPotentialProxies(rootURI);
		var frameSearchURIs = isFrame ? Zotero.Proxies.getPotentialProxies(URI) : rootSearchURIs;

		Zotero.debug("Translators: Looking for translators for "+Object.keys(frameSearchURIs).join(', '));

		for(var i=0; i<allTranslators.length; i++) {
			var translator = allTranslators[i];
			if (isFrame && !translator.webRegexp.all) {
				continue;
			}
			rootURIsLoop:
			for(var rootSearchURI in rootSearchURIs) {
				var isGeneric = !allTranslators[i].webRegexp.root;
				// don't attempt to use generic translators that can't be run in this browser
				// since that would require transmitting every page to Zotero host
				if(isGeneric && allTranslators[i].runMode !== Zotero.Translator.RUN_MODE_IN_BROWSER) {
					continue;
				}

				var rootURIMatches = isGeneric || rootSearchURI.length < 8192 && translator.webRegexp.root.test(rootSearchURI);
				if (translator.webRegexp.all && rootURIMatches) {
					for (var frameSearchURI in frameSearchURIs) {
						var frameURIMatches = frameSearchURI.length < 8192 && translator.webRegexp.all.test(frameSearchURI);
							
						if (frameURIMatches) {
							potentialTranslators.push(translator);
							proxies.push(frameSearchURIs[frameSearchURI]);
							// prevent adding the translator multiple times
							break rootURIsLoop;
						}
					}
				} else if(!isFrame && (isGeneric || rootURIMatches)) {
					potentialTranslators.push(translator);
					proxies.push(rootSearchURIs[rootSearchURI]);
					break;
				}
			}
		}
		
		var codeGetter = new Zotero.Translators.CodeGetter(potentialTranslators);
		return codeGetter.getAll().then(function () {
			return [potentialTranslators, proxies];
		});
	};

	/**
	 * Converts translators to JSON-serializable objects
	 */
	this.serialize = function(translator, properties) {
		// handle translator arrays
		if(translator.length !== undefined) {
			var newTranslators = new Array(translator.length);
			for(var i in translator) {
				newTranslators[i] = Zotero.Translators.serialize(translator[i], properties);
			}
			return newTranslators;
		}
		
		// handle individual translator
		var newTranslator = {};
		for(var i in properties) {
			var property = properties[i];
			newTranslator[property] = translator[property];
		}
		return newTranslator;
	}
});

module.exports = Translators;