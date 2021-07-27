/* global assert:false, request:false, testURL:false */

describe("/web", function () {
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
		assert.lengthOf(json, 2);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, 'Title');
		// This item contains an snapshot
		assert.equal(json[1].itemType, 'attachment');
		assert.equal(json[1].parentItem, json[0].key);
		assert.equal(json[1].mimeType, 'text/html');
		assert.equal(json[1].url, url);
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
		assert.lengthOf(json, 3);
		assert.equal(json[0].title, 'A');
		assert.equal(json[1].parentItem, json[0].key);
		assert.equal(json[1].url, url);
		assert.equal(json[2].title, 'C');
	});
	
	
	// Simulate a request to a different server without the cached session id
	it("should return multiple results and perform follow-up translation with unknown session id", async function () {
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
		// Change the session id
		json.session[0] = json.session[0] == 'a' ? 'b' : 'a';
		
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
		
		assert.lengthOf(json, 2);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, 'Title');
		assert.equal(json[0].url, finalURL);
		// This item contains an snapshot
		assert.equal(json[1].itemType, 'attachment');
		assert.equal(json[1].parentItem, json[0].key);
		assert.equal(json[1].mimeType, 'text/html');
		assert.equal(json[1].url, finalURL);
	});
	
	
	it("should translate a remote BibTeX file", async function () {
		var url = testURL + 'bibtex';
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
		
		assert.lengthOf(json, 2);
		assert.equal(json[0].itemType, 'journalArticle');
		assert.equal(json[0].title, 'Titre');
		// This item contains an snapshot
		assert.equal(json[1].itemType, 'attachment');
		assert.equal(json[1].parentItem, json[0].key);
		assert.equal(json[1].mimeType, 'text/html');
		assert.equal(json[1].url, url);
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
