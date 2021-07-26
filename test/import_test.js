/* global assert:false, request:false */

'use strict';

const fs = require('fs');
const path = require('path');

function flatten(array) {
	return [].concat.apply([], array);
}

function addTest(name, translatorID, input, expected) {
	it(`should import ${name}`, async function () {
		const response = await request()
			.post('/import')
			.send(input)
			.set('Content-Type', 'text/plain')
			.expect(200);

		assert.equal(response.headers['zotero-translator-id'], translatorID);

		const items = {
			expected: flatten(expected.map(item => Zotero.Utilities.Item.itemToAPIJSON(item))), // normalize and flatten results
			found: response.body,
		};

		for (const ef of ['expected', 'found']) {
			for (const item of items[ef]) {
				// inline attached notes -- notes are exported as separate items with a parentItem, but the parentItem is going to be different every time the test is ran
				if (!item.notes) {
					item.notes = items[ef]
						.filter(note => (note.itemType === 'note' && note.parentItem === item.key))
						.map(note => ({ note: note.note, itemType: note.itemType}));
				}
			}
			// remove notes now inlined
			items[ef] = items[ef].filter(item => (item.itemType !== 'note' || !item.parentItem));

			for (const item of items[ef]) {
				// remove purely administrative fields -- must be done in 2nd run because the key/parentItem are required in the 1st run for inlining notes
				delete item.key;
				delete item.version;
				delete item.parentItem;

				// remove empty array to simplify comparison
				if (Array.isArray(item.tags) && !item.tags.length) {
					delete item.tags;
				}

				// sort tags for stable comparison
				if (item.tags) {
					item.tags.sort((a, b) => `${a.type}::${a.tag}`.localeCompare(`${b.type}::${b.tag}`));
				}
			}
		}

		assert.deepEqual(items.expected, items.found);
	});
}

function parseJSON(name, json, source) {
	try {
		return JSON.parse(json);
	}
	catch (err) {
		it(`should import ${name}`, function () {
			const m = err.message.match(/(.*) at position ([0-9]+)$/);
			if (m) {
				const pos = parseInt(m[2]);
				const line = source.substring(0, source.indexOf(json) + pos).split('\n').length;
				const column = pos - json.lastIndexOf('\n', pos);
				throw new Error(`${m[1]} around line ${line}, column ${column}`);
			}
			throw err;
		});
	}
	return null;
}

(process.env.IMPORT_TESTS ? describe : describe.skip)("/import", function () {
	const translators = path.join(__dirname, '../modules/translators');
	for (const translator of fs.readdirSync(translators)) {
		if (!translator.endsWith('.js')) continue;

		const name = translator.replace(/\.js$/, '');
		const code = fs.readFileSync(path.join(translators, translator), 'utf-8');

		const marker = code.indexOf('/** BEGIN TEST CASES **/');
		if (marker === -1) continue;

		const header = parseJSON(name, code.replace(/\n}\n[\s\S]*/, '}'), code);
		if (!header) continue;
		const start = code.indexOf('[', marker);
		const end = code.lastIndexOf(']') + 1;

		const cases = parseJSON(name, code.substring(Math.max(start, marker), Math.max(end, start, marker)), code);
		if (!cases) continue;

		let caseNo = 0;
		for (const test of cases) {
			caseNo += 1;
			if (test.type !== 'import') continue;
			addTest(`${name} # ${caseNo}`, header.translatorID, test.input, test.items);
		}
	}
});
