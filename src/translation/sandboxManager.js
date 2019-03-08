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


/**
 * @class Manages the translator sandbox
 * @param {Translate} translate
 * @param {String|window} sandboxLocation
 */
var SandboxManager = function(sandboxLocation) {
	this.sandbox = {
		"Zotero":{},
		Promise,
	};
};

SandboxManager.prototype = {
	/**
	 * Evaluates code in the sandbox
	 * @param {String} code Code to evaluate
	 * @param {String[]} functions Functions to import into the sandbox (rather than leaving
	 *                                 as inner functions)
	 */
	eval: function(code, functions) {
		// delete functions to import
		for (var i in functions) {
			delete this.sandbox[functions[i]];
		}

		// Prepend sandbox properties within eval environment (what a mess (1))
		for (var prop in this.sandbox) {
			code = 'var ' + prop + ' = this.sandbox.' + prop + ';' + code;
		}

		// Import inner functions back into the sandbox
		for (var i in functions) {
			// TODO: Omit in translate.js?
			if (functions[i] == 'detectExport') continue;
			
			try {
				code += 'this.sandbox.' + functions[i] + ' = ' + functions[i] + ';';
			} catch (e) {
			}
		}

		// Eval in a closure
		(function() {
			eval(code);
		}).call(this);
	},
	
	/**
	 * Imports an object into the sandbox
	 *
	 * @param {Object} object Object to be imported (under Zotero)
	 * @param {Boolean} passTranslateAsFirstArgument Whether the translate instance should be passed
	 *     as the first argument to the function.
	 */
	importObject: function(object, passAsFirstArgument, attachTo) {
		if(!attachTo) attachTo = this.sandbox.Zotero;
		
		for(var key in (object.__exposedProps__ ? object.__exposedProps__ : object)) {
			if(Function.prototype[key]) continue;
			if(typeof object[key] === "function" || typeof object[key] === "object") {
				// magic closures
				attachTo[key] = new function() {
					var fn = object[key];
					return function() {
						var args = (passAsFirstArgument ? [passAsFirstArgument] : []);
						for(var i=0; i<arguments.length; i++) {
							args.push(arguments[i]);
						}
						
						return fn.apply(object, args);
					};
				}
				
				// attach members
				this.importObject(object[key], passAsFirstArgument ? passAsFirstArgument : null, attachTo[key]);
			} else {
				attachTo[key] = object[key];
			}
		}
	}
}

module.exports = SandboxManager;
