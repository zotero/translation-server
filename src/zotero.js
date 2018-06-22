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
	
	this.init = async function (port) {
		// ensure browser is online
		
		// Zotero.Prefs.init();
		// Zotero.Debug.init();
		// await Zotero.Date.init();
		// Zotero.Connector_Types.init();
		// Zotero.Server.Translation.init();
		// if(port !== false) {
		// 	Zotero.Server.init(port, true, 1000);
		// }
	};
	
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

// TODO: Pref store
Zotero.Prefs = new function(){
	const DEFAULTS = {
		"translatorsDirectory": './modules/translators'
	};
	
	this.init = function() {};
	
	this.get = function(pref) {
		if (DEFAULTS.hasOwnProperty(pref)) return DEFAULTS[pref];
	};

	/**
	 * Should override per browser
	 * @param pref
	 * @param value
	 */
	this.set = function(pref, value) {};

	/**
	 * Should override per browser
	 * @param pref
	 */
	this.clear = function(pref) {}
}

Zotero.Promise = require('./promise');
Zotero.Debug = require('./debug');
Zotero.Translators = require('./translators');
Zotero.Date = require('./date');
Zotero.OpenURL = require('./openurl');
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
var { JSDOM } = require('jsdom');
global.DOMParser = new JSDOM('<html></html>').window.DOMParser;
var wgxpath = require('wicked-good-xpath');
global.XPathResult = wgxpath.XPathResultType;