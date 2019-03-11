'use strict';

const fs = require('fs');
const path = require('path');

function parseJSON(name, json, source) {
	try {
		return JSON.parse(json);
	}
	catch (err) {
		const m = err.message.match(/(.*) at position ([0-9]+)$/);
		if (m) {
			const pos = parseInt(m[2]);
			const line = source.substring(0, source.indexOf(json) + pos).split('\n').length;
			const column = pos - json.lastIndexOf('\n', pos);
			return ({ error: `${m[1]} around line ${line}, column ${column}` });
		}

		return ({ error: err.message });
	}
}

function extract (type) {
	const tests = [];
	const translators = path.join(__dirname, '../modules/translators');
	for (const translator of fs.readdirSync(translators)) {
		if (!translator.endsWith('.js')) continue;

		const name = translator.replace(/\.js$/, '');
		const code = fs.readFileSync(path.join(translators, translator), 'utf-8');

		const marker = code.indexOf('/** BEGIN TEST CASES **/');
		if (marker === -1) continue;

		const header = parseJSON(name, code.replace(/\n}\n[\s\S]*/, '}'), code);
		if (header.error) {
			tests.push({
				name,
				error: `translator header: ${header.error}`,
			});
			continue;
		}

		const start = code.indexOf('[', marker);
		const end = code.lastIndexOf(']') + 1;

		const cases = parseJSON(name, code.substring(Math.max(start, marker), Math.max(end, start, marker)), code);
		if (cases.error) {
			tests.push({
				name,
				error: `test cases: ${header.error}`,
			});
			continue;
		}

		let caseNo = 0;
		for (const test of cases) {
			caseNo += 1;
			if (test.type !== type) continue;
			tests.push({
				name: `${name} # ${caseNo}`,
				translatorID: header.translatorID,
				...test
			})
		}
	}
	return tests;
}

module.exports = extract;
