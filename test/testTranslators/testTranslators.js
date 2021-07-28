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

'use strict';

process.on('unhandledRejection', (err, p) => { 
	console.error(err);
});

require('../../src/zotero');
require('../../src/translation/translate');
require('../../src/http');

const { basename } = require('path');
const yargs = require('yargs');
const fs = require('fs').promises;
const { jar: cookieJar } = require('request');
const {TranslatorTester} = require('../../modules/translate/testTranslators/translatorTester.js');

let options = yargs
	.usage(`Usage: ${basename(process.argv[0])} [options]`)
	.wrap(78)
	.option('output', {
		type: 'string',
		alias: 'o',
		describe: 'Path to the output file for translation results'
	})
	.option('cross-origin', {
		type: 'boolean',
		default: true,
		describe: 'Enable cross-origin HTTP requests in translators'
	})
	.option('num-concurrent-tests', {
		type: 'number',
		default: 10
	})
	.option('grep', {
		type: 'string',
		alias: 'g',
		describe: 'Only test translators with matching labels or ids'
	})
	.option('browser', {
		type: 'string',
		alias: 'b',
		default: 'v',
		describe: "The browser flag"
	})
	.argv;

// For debugging specific translators by label
let regexp = options.g && new RegExp(options.g);

const TEST_TYPES = ["web", "import", "export", "search"];
var results = [];

// NOTE: We need to attach a cookie sandbox to the translate instances to make websites with
// cookie forgetting browser/scrapper protection happy when calling HTTP.processDocuments().
// Thus we're overriding the translate instance constructing method and attaching a cookie jar
Zotero.Translate.newInstance = function(type) {
	let translate = new Zotero.Translate[type.substr(0, 1).toUpperCase()+type.substr(1).toLowerCase()];
	if (translate.setCookieSandbox) {
		translate.setCookieSandbox(cookieJar());
	}
	return translate;
}

if (!options.crossOrigin) {
	// Monkey patching translator http methods to disallow cross-origin requests
	let throwIfDifferentOrigins = function(origin, url) {
		let a = new URL(origin), b = new URL(url);
		if (a.origin != b.origin) {
			throw new Error(`Cross origin request from ${origin} to ${url} not allowed`);
		}
	}
	let doGet = Zotero.Utilities.Translate.prototype.doGet;
	let doPost = Zotero.Utilities.Translate.prototype.doPost;
	Zotero.Utilities.Translate.prototype.doGet = function(urls) {
		if (!this._translate.location) return;
		if(typeof(urls) == "string") {
			var url = urls;
		} else {
			var url = arguments[0].shift();
		}
		throwIfDifferentOrigins(this._translate.location, url);
		return doGet.apply(this, arguments);
	}
	Zotero.Utilities.Translate.prototype.doPost = function() {
		if (!this._translate.location) return;
		throwIfDifferentOrigins(this._translate.location, arguments[0]);
		return doPost.apply(this, arguments);
	}
}
	
/**
 * Runs a specific set of tests
 */
async function runTesters(translators, type) {
	for (let translator of translators) {
		let tester = new TranslatorTester(translator, type, (_, t)=> console.log(t + '\n'));
		await new Promise(resolve => {
			tester.runTests(function() {
				try {
					if(tester.pending.length) return;

					// Done translating, so serialize test results
					let result = tester.serialize();
					results.push(result);
					resolve(result);
				} catch(e) {
					Zotero.debug(e);
					Zotero.logError(e);
					resolve();
				}
			})
		});
	}
	return;
}


(async function() {

Zotero.Debug.init(0);
await Zotero.Translators.init();

for (let type of TEST_TYPES) {
	let translators = await Zotero.Translators.getAllForType(type, true);
	
	try {
		// Concurrent async via iterators magic
		// https://stackoverflow.com/a/51020535
		if (regexp) {
			translators = translators.filter(t => regexp.test(t.label) || regexp.test(t.translatorID));
		}
		let iterator = translators.values();
		let promises = new Array(options.numConcurrentTests).fill(iterator).map(t => runTesters(t, type));
		await Promise.all(promises);
	} catch(e) {
		Zotero.debug(e);
		Zotero.logError(e);
	}
}

results.sort(function(a, b) {
	var atype = TEST_TYPES.indexOf(a.type);
	var btype = TEST_TYPES.indexOf(b.type);
	if (atype != btype) return atype-btype;
	else return a.label.localeCompare(b.label);
})

let result = {
	browser: options.browser,
	version: Zotero.version,
	results: results
};
if (options.o) {
	await fs.writeFile(options.o, JSON.stringify(result, null, '\t'));
}
// If any tests failed, return non-0 exit code
let retVal = 0;
if (results.some(r => r.failed.length || r.unknown.length)) {
	retVal = 1;
}
process.exit(retVal);
})();
