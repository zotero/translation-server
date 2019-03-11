const extract_tests = require('./test_extract');

function addTest(name, translatorID, url, expected, ignoreStatusCode) {
	it(`should translate a webpage using ${name}`, async function () {
		const response = await request({ simple: false })
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);

		if (response.statusCode === ignoreStatusCode) return;

		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.body, expected);
	});
}

describe("/web", function () {
	for (const test of extract_tests('web')) {
		if (test.error) {
			it(`should translate a webpage using ${test.name}`, function () {
				throw new Error(test.error);
			});
			continue;
		}

		addTest(test.name, test.translatorID, test.url, test.items, test.ignoreStatusCode);
	}

	it("should translate a generic webpage", async function () {
		var url = testURL + 'plain';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 1);
		assert.equal(json[0].itemType, 'webpage');
		assert.equal(json[0].title, 'Test');
	});
	
	
	it("should translate a webpage with embedded metadata", async function () {
		var url = testURL + 'single';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 1);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, 'Title');
	});
	
	
	it("should return multiple results and perform follow-up translation", async function () {
		var url = testURL + 'multiple';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 300);
		var json = response.body;
		assert.equal(json.url, url);
		assert.property(json, 'session');
		assert.deepEqual(json.items, { 0: 'A', 1: 'B', 2: 'C' });
		
		delete json.items[1];
		
		response = await request()
			.post('/web')
			.send(json);
		assert.equal(response.statusCode, 200);
		json = response.body;
		assert.lengthOf(json, 2);
		assert.equal(json[0].title, 'A');
		assert.equal(json[1].title, 'C');
	});
	
	
	it("should follow a redirect and use the final URL for translation", async function () {
		var url = testURL + 'redirect';
		var finalURL = testURL + 'single';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 1);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, 'Title');
		assert.equal(json[0].url, finalURL);
	});
	
	
	it("should return 400 if a page returns a 404", async function () {
		var url = testURL + '404';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 400);
		assert.equal(response.text, 'Remote page not found');
	});
	
	
	// Note: This doesn't test subsequent requests during translation
	it("should forward the Accept-Language header in the initial request", async function () {
		var url = testURL + 'single';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.set('Accept-Language', 'fr')
			.send(url);
		assert.equal(response.statusCode, 200);
		var json = response.body;
		
		assert.lengthOf(json, 1);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, 'Titre');
	});
	
	it("should reject non-HTML/XML upstream content types", async function () {
		var url = testURL + 'invalidContentType';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 400);
		assert.equal(response.text, "The remote document is not in a supported format");
	});
	
	it("should reject missing upstream Content-Type header", async function () {
		var url = testURL + 'missingContentType';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 400);
		assert.equal(response.text, "The remote document is not in a supported format");
	});
});
