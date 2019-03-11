'use strict';

const extract_tests = require('./test_extract');

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

describe("/import", function () {
	for (const test of extract_tests('import')) {
		if (test.error) {
			it(`should import ${test.name}`, function () {
				throw new Error(test.error);
			});
			continue;
		}

		addTest(test.name, test.translatorID, test.input, test.items);
	}
});
