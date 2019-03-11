'use strict';

const fs = require('fs');
const path = require('path');

function addTest(name, translatorID, input, expected) {
	it(`should import ${name}`, async function () {
		const response = await request()
			.post('/import')
			.send(input)
			.set('Content-Type', 'text/plain')
			.expect(200);

		assert.equal(response.headers['zotero-translator-id'], translatorID);

		assert.deepEqual(response.body, expected);
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

describe.skip("/import", function () {
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
