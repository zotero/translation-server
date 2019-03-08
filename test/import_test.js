const fs = require('fs');
const path = require('path');

const endpoint = require('../src/importEndpoint');

function addTest(name, input, expected) {
	for (const item of expected) {
		endpoint.normalizeItem(item);
	}

	it(`should import ${name}`, async function () {
		const response = await request()
			.post('/import')
			.send(input)
			.set('Content-Type', 'text/plain')
			.expect(200);

		for (const item of response.body) {
			endpoint.normalizeItem(item);
		}

		assert.deepEqual(response.body, expected);
	});
}

describe("/import", function () {
	const translators = path.join(__dirname, '../modules/translators');
	for (const translator of fs.readdirSync(translators)) {
		if (!translator.endsWith('.js')) continue;

		const name = translator.replace(/\.js$/, '');
		const code = fs.readFileSync(path.join(translators, translator), 'utf-8');

		let start = code.indexOf('/** BEGIN TEST CASES **/');
		if (start === -1) continue;
		let cases = null;

		try {
			start = code.indexOf('[', start);
			if (start === -1) throw new Error('Could not find start of test cases');

			const end = code.lastIndexOf(']') + 1;
			if (end === -1) throw new Error('Could not find end of test cases');

			cases = code.substring(start, end);
			let caseNo = 0;
			for (const test of JSON.parse(cases)) {
				caseNo += 1;
				if (test.type === 'import') addTest(`${name} # ${caseNo}`, test.input, test.items);
			}

		} catch (err) {
			it(`should import ${name}`, function () {
				const m = err.message.match(/(.*) at position ([0-9]+)$/);
				if (m && typeof cases === 'string') {
					const pos = parseInt(m[2]);
					const line = code.substring(0, start + pos).split('\n').length;
					const column = pos - cases.lastIndexOf('\n', pos);
					throw new Error(`${m[1]} at line ${line}, column ${column}`);
				}
				throw err;
			});
		}
	}
});
