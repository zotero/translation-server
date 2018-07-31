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

const path = require('path');
const config = require('config');

const ZOTERO_CONFIG = {
	REPOSITORY_URL: 'https://repo.zotero.org/repo',
	REPOSITORY_CHECK_INTERVAL: 86400, // 24 hours
	REPOSITORY_RETRY_INTERVAL: 3600, // 1 hour
	REPOSITORY_CHANNEL: 'trunk',
	BASE_URI: 'https://zotero.org/',
	WWW_BASE_URL: 'https://www.zotero.org/',
	API_URL: 'https://api.zotero.org/',
};

var Zotero = module.exports = new function() {
	this.isNode = true;
	this.isServer = true;
	this.locale = 'en-US';
	
	/**
	 * Debug logging function
	 *
	 * Uses prefs e.z.debug.log and e.z.debug.level (restart required)
	 *
	 * Defaults to log level 3 if level not provided
	 */
	this.debug = function(message, level) {
		Zotero.Debug.log(message, level);
	}
	
	/**
	 * Log a JS error to the Mozilla JS error console.
	 * @param {Exception} err
	 */
	this.logError = function(err) {
		// Firefox uses this
		Zotero.debug(err);
	}
}

global.Zotero = Zotero;

// TODO: Pref store
Zotero.Prefs = new function(){
	var tempStore = {};
	
	this.get = function(pref) {
		if (tempStore.hasOwnProperty(pref)) return tempStore[pref];
		if (config.has(pref)) return config.get(pref);
	};

	/**
	 * @param pref
	 * @param value
	 */
	this.set = function(pref, value) {
		tempStore[pref] = value;
	};

	/**
	 * @param pref
	 */
	this.clear = function(pref) {
		delete tempStore[pref];
	}
}

/**
 * A custom require function to import modules from the main Zotero codebase
 * @param {String} path
 * @returns {*}
 */
Zotero.require = function(modulePath) {
	return require(path.resolve(__dirname, '../modules/zotero/chrome/content/zotero/xpcom/', modulePath));
}

Zotero.Promise = require('./promise');
Zotero.Debug = require('./debug');
Zotero.Translators = require('./translators');
Zotero.Date = Zotero.require('./date');
Zotero.OpenURL = Zotero.require('./openurl');
Zotero.Utilities = require('./utilities');
Zotero.Translator = require('./translator');
Zotero.Proxies = require('./proxy').Proxies;
Zotero.Proxy = require('./proxy').Proxy;
var $rdf = require('./rdf/init');
if(Zotero.RDF) {
	Zotero.RDF.AJAW = $rdf;
} else {
	Zotero.RDF = {AJAW:$rdf};
}
Zotero = Object.assign(Zotero, require('./cachedTypes'));

// Providing these for the translation architecture
var wgxpath = require('wicked-good-xpath');
global.XPathResult = wgxpath.XPathResultType;
var { JSDOM } = require('jsdom');
var dom = new JSDOM('<html></html>');
wgxpath.install(dom.window, true);
global.DOMParser = dom.window.DOMParser;
global.XMLSerializer = require("w3c-xmlserializer/lib/XMLSerializer").interface;
