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
	
	
	it("should return 400 if a page returns a 404", async function () {
		var url = testURL + '404';
		var response = await request()
			.post('/web')
			.set('Content-Type', 'text/plain')
			.send(url);
		assert.equal(response.statusCode, 400);
		assert.equal(response.text, 'Remote page not found');
	});
});
