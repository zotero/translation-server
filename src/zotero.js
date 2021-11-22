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
const fs = require('fs');

var Zotero = global.Zotero = module.exports = new function() {
	this.isNode = true;
	this.isServer = true;
	this.locale = 'en-US';
	
	this.version = "5.0.97";
	
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
	
	this.setTimeout = setTimeout;
}

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
 * A custom require function to import modules from the translate submodule
 * @param {String} modulePath
 * @returns {*}
 */
Zotero.requireTranslate = function(modulePath) {
	return require(path.resolve(__dirname, '../modules/translate/src/', modulePath));
}

Zotero.requireUtilities = function(modulePath) {
	return require(path.resolve(__dirname, '../modules/utilities/', modulePath));
}

Zotero.Promise = Zotero.requireTranslate('./promise');
Zotero.Debug = Zotero.requireTranslate('./debug');
Zotero.Translators = require('./translators');
Zotero.Date = Zotero.requireUtilities('./date');
Zotero.Date.init(Zotero.requireUtilities('./resource/dateFormats.json'))
Zotero.OpenURL = Zotero.requireUtilities('./openurl');
Zotero.Utilities = require('./utilities');
Zotero.Translator = Zotero.requireTranslate('./translator');
Zotero.Translate = require('./translation/translate');
Zotero.Proxies = require('./proxy').Proxies;
Zotero.Proxy = require('./proxy').Proxy;

var $rdf = Zotero.requireTranslate('./rdf/init');
if(Zotero.RDF) {
	Zotero.RDF.AJAW = $rdf;
} else {
	Zotero.RDF = {AJAW:$rdf};
}
Zotero = Object.assign(Zotero, Zotero.requireUtilities('./cachedTypes'));
Zotero.setTypeSchema(Zotero.requireUtilities('./resource/zoteroTypeSchemaData'));